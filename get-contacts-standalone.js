#!/usr/bin/env node

const axios = require('axios');

// Configuration
const SERVER_URL = 'http://127.0.0.1:3000';
const TARGET_TAG = 'client software pipeline';
const DEFAULT_LIMIT = 25; // Default limit for contacts

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m'
};

// Helper function for colored logging
function log(message, color = 'reset') {
    const colorCode = colors[color] || colors.reset;
    console.log(`${colorCode}${message}${colors.reset}`);
}

// Check server health
async function checkServerHealth() {
    try {
        const response = await axios.get(`${SERVER_URL}/health`);
        return response.data;
    } catch (error) {
        throw new Error(`Server health check failed: ${error.message}`);
    }
}

// Check OAuth status
async function checkOAuthStatus() {
    try {
        const response = await axios.get(`${SERVER_URL}/oauth/status`);
        const data = response.data;
        
        // Add debugging information
        log(`🔍 OAuth Response: ${JSON.stringify(data, null, 2)}`, 'dim');
        
        if (!data.authenticated) {
            throw new Error('Not authenticated');
        }
        
        // Handle different field name formats from the server
        const locationId = data.locationId || data.location_id;
        const expiresAt = data.expiresAt || data.expires_at;
        
        if (!locationId) {
            log('⚠️  Warning: No location ID in OAuth response', 'yellow');
        }
        
        // Check if we have tokens in the response
        if (data.tokens && data.tokens.access_token) {
            log('✅ Access token found in OAuth response', 'green');
            return {
                authenticated: true,
                locationId: locationId,
                expiresAt: expiresAt,
                tokens: data.tokens
            };
        }
        
        // If no tokens in OAuth response, try to get them from a separate endpoint
        log('🔄 No tokens in OAuth response, trying to get tokens...', 'blue');
        try {
            const tokensResponse = await axios.get(`${SERVER_URL}/oauth/tokens`);
            const tokensData = tokensResponse.data;
            
            if (tokensData && tokensData.access_token) {
                log('✅ Access token retrieved from tokens endpoint', 'green');
                return {
                    authenticated: true,
                    locationId: locationId,
                    expiresAt: expiresAt,
                    tokens: tokensData
                };
            } else {
                throw new Error('No access token available in tokens response');
            }
        } catch (tokenError) {
            if (tokenError.response?.status === 401) {
                log('❌ Authentication failed - token expired or invalid', 'red');
                throw new Error('Authentication failed - please re-authenticate with GoHighLevel');
            } else if (tokenError.response?.status === 404) {
                log('❌ Tokens endpoint not found - server may need restart', 'red');
                throw new Error('Tokens endpoint not available - please restart your OAuth server');
            } else {
                log(`⚠️  Could not get tokens: ${tokenError.message}`, 'yellow');
                throw new Error('No access token available - please check OAuth setup');
            }
        }
        
    } catch (error) {
        throw new Error(`OAuth status check failed: ${error.message}`);
    }
}

// Search contacts with specific tag using GoHighLevel search endpoint
async function searchContactsByTag(limit = DEFAULT_LIMIT, oauthData = null) {
    try {
        // Use passed OAuth data or get it fresh
        let tokens, locationId;
        
        if (oauthData && oauthData.tokens && oauthData.tokens.access_token) {
            tokens = oauthData.tokens;
            locationId = oauthData.locationId;
            log('✅ Using OAuth data from previous check', 'green');
        } else {
            log('🔄 Fetching fresh OAuth data...', 'blue');
            const oauthResponse = await axios.get(`${SERVER_URL}/oauth/status`);
            if (!oauthResponse.data.authenticated) {
                throw new Error('Not authenticated');
            }
            
            // Handle different field name formats
            tokens = oauthResponse.data.tokens;
            locationId = oauthResponse.data.locationId || oauthResponse.data.location_id;
            
            if (!tokens || !tokens.access_token) {
                throw new Error('No access token available');
            }
        }
        
        // Ensure we have a locationId before proceeding
        if (!locationId) {
            throw new Error('Location ID is required but not available');
        }
        
        log(`🔍 Searching for contacts with tag: "${TARGET_TAG}" (limit: ${limit})`, 'bright');
        if (locationId) {
            log(`📍 Location ID: ${locationId}`, 'blue');
        }
        
        // Use the GoHighLevel search endpoint with proper filtering
        const searchUrl = 'https://services.leadconnectorhq.com/contacts/search';
        
        // Format the query as a string (API requirement)
        // Try multiple query formats to see which one works
        const queryFormats = [
            `tag:"${TARGET_TAG}"`,
            `tags:"${TARGET_TAG}"`,
            `"${TARGET_TAG}"`,
            TARGET_TAG
        ];
        
        let searchResponse;
        let workingQuery = '';
        
        // Try each query format until one works
        for (const queryFormat of queryFormats) {
            try {
                log(`🔍 Trying query format: "${queryFormat}"`, 'blue');
                
                searchResponse = await axios.post(searchUrl, 
                    {
                        // Search body with proper API format
                        locationId: locationId,
                        query: queryFormat,
                        pageLimit: limit // Use pageLimit instead of limit
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${tokens.access_token}`,
                            'Version': '2021-07-28',
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        }
                    }
                );
                
                workingQuery = queryFormat;
                log(`✅ Query format "${queryFormat}" worked!`, 'green');
                break;
                
            } catch (error) {
                log(`❌ Query format "${queryFormat}" failed: ${error.response?.data?.message || error.message}`, 'red');
                continue;
            }
        }
        
        if (!searchResponse) {
            throw new Error('All query formats failed - cannot search contacts');
        }
        
        const searchData = searchResponse.data;
        const contacts = searchData.contacts || [];
        const total = searchData.total || 0;
        
        // Debug: Show the raw search response
        log(`🔍 Raw search response: ${JSON.stringify(searchData, null, 2)}`, 'dim');
        
        log(`✅ Found ${total} total contacts with tag "${TARGET_TAG}"`, 'green');
        log(`📊 Retrieved ${contacts.length} contacts in this batch`, 'blue');
        
        // Since we're filtering by tag in the API call, all returned contacts should have the tag
        // But let's double-check to be safe
        const taggedContacts = contacts.filter(contact => {
            if (contact.tags && Array.isArray(contact.tags)) {
                return contact.tags.some(tag => 
                    tag.toLowerCase() === TARGET_TAG.toLowerCase()
                );
            }
            return false;
        });
        
        if (taggedContacts.length !== contacts.length) {
            log(`⚠️  Warning: API returned ${contacts.length} contacts but only ${taggedContacts.length} have the target tag`, 'yellow');
        }
        
        return {
            success: true,
            total_contacts: total,
            tagged_contacts: taggedContacts,
            all_contacts: contacts,
            search_metadata: {
                endpoint: 'contacts/search',
                tag_filter: TARGET_TAG,
                method: 'POST',
                limit: limit,
                query: { tags: [TARGET_TAG] }
            }
        };
        
    } catch (error) {
        if (error.response?.status === 401) {
            throw new Error('Authentication failed - token may be expired');
        } else if (error.response?.status === 400) {
            throw new Error(`Bad request: ${error.response.data?.message || 'Invalid search parameters'}`);
        } else if (error.response?.status === 404) {
            throw new Error('Search endpoint not found');
        } else {
            throw new Error(`Search failed: ${error.response?.data?.message || error.message}`);
        }
    }
}

// Fallback: Get all contacts and filter by tag (if search fails)
async function getAllContacts() {
    try {
        // Try the contacts endpoint first
        const response = await axios.get(`${SERVER_URL}/contacts`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            return {
                success: false,
                message: 'Contacts endpoint not available yet. Server needs to be restarted to load new endpoint.',
                location_id: 'QLyYYRoOhCg65lKW9HDX',
                contacts: []
            };
        }
        throw new Error(`Failed to fetch contacts: ${error.response?.data?.error || error.message}`);
    }
}

// Display complete contact object
function displayCompleteContact(contact, index) {
    log(`\n${'='.repeat(60)}`, 'cyan');
    log(`📋 CONTACT ${index + 1}: COMPLETE OBJECT`, 'bright');
    log(`${'='.repeat(60)}`, 'cyan');
    
    // Display all available fields from the contact object
    const fields = [
        { key: 'id', label: 'ID', color: 'cyan' },
        { key: 'locationId', label: 'Location ID', color: 'blue' },
        { key: 'contactName', label: 'Contact Name', color: 'bright' },
        { key: 'firstName', label: 'First Name', color: 'bright' },
        { key: 'lastName', label: 'Last Name', color: 'bright' },
        { key: 'firstNameRaw', label: 'First Name Raw', color: 'dim' },
        { key: 'lastNameRaw', label: 'Last Name Raw', color: 'dim' },
        { key: 'companyName', label: 'Company Name', color: 'blue' },
        { key: 'businessName', label: 'Business Name', color: 'blue' },
        { key: 'email', label: 'Email', color: 'yellow' },
        { key: 'phone', label: 'Phone', color: 'yellow' },
        { key: 'phoneLabel', label: 'Phone Label', color: 'yellow' },
        { key: 'additionalPhones', label: 'Additional Phones', color: 'yellow' },
        { key: 'dnd', label: 'Do Not Disturb', color: 'magenta' },
        { key: 'type', label: 'Type', color: 'green' },
        { key: 'source', label: 'Source', color: 'green' },
        { key: 'assignedTo', label: 'Assigned To', color: 'blue' },
        { key: 'city', label: 'City', color: 'blue' },
        { key: 'state', label: 'State', color: 'blue' },
        { key: 'postalCode', label: 'Postal Code', color: 'blue' },
        { key: 'address', label: 'Address', color: 'blue' },
        { key: 'country', label: 'Country', color: 'blue' },
        { key: 'dateAdded', label: 'Date Added', color: 'green' },
        { key: 'dateUpdated', label: 'Date Updated', color: 'green' },
        { key: 'dateOfBirth', label: 'Date of Birth', color: 'green' },
        { key: 'businessId', label: 'Business ID', color: 'cyan' },
        { key: 'website', label: 'Website', color: 'yellow' },
        { key: 'timezone', label: 'Timezone', color: 'blue' },
        { key: 'profilePhoto', label: 'Profile Photo', color: 'magenta' },
        { key: 'validEmail', label: 'Valid Email', color: 'green' }
    ];
    
    fields.forEach(field => {
        if (contact[field.key] !== undefined && contact[field.key] !== null) {
            let value = contact[field.key];
            
            // Format dates
            if (field.key.includes('date') && value) {
                try {
                    value = new Date(value).toLocaleString();
                } catch (e) {
                    // Keep original value if date parsing fails
                }
            }
            
            // Format boolean values
            if (typeof value === 'boolean') {
                value = value ? 'Yes' : 'No';
            }
            
            // Format arrays
            if (Array.isArray(value)) {
                if (value.length === 0) {
                    value = '[] (empty)';
                } else if (value.length <= 3) {
                    value = `[${value.join(', ')}]`;
                } else {
                    value = `[${value.slice(0, 3).join(', ')}... and ${value.length - 3} more]`;
                }
            }
            
            // Format objects
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                value = JSON.stringify(value, null, 2).substring(0, 100) + (JSON.stringify(value).length > 100 ? '...' : '');
            }
            
            log(`${field.label}: ${value}`, field.color);
        }
    });
    
    // Display tags prominently since this is what we're filtering by
    if (contact.tags && Array.isArray(contact.tags) && contact.tags.length > 0) {
        log('\n🏷️  TAGS (Filtered by these):', 'bright');
        contact.tags.forEach((tag, tagIndex) => {
            const isTargetTag = tag.toLowerCase() === TARGET_TAG.toLowerCase();
            const tagColor = isTargetTag ? 'green' : 'dim';
            const tagIcon = isTargetTag ? '🎯' : '🏷️';
            log(`   ${tagIcon} ${tagIndex + 1}. ${tag}`, tagColor);
        });
    }
    
    // Display custom fields if they exist
    if (contact.customFields && Array.isArray(contact.customFields) && contact.customFields.length > 0) {
        log('\n🔧 Custom Fields:', 'magenta');
        contact.customFields.forEach((customField, cfIndex) => {
            log(`   ${cfIndex + 1}. ${customField.name || 'Unnamed'}: ${customField.value || 'No value'}`, 'dim');
        });
    }
    
    // Display followers if they exist
    if (contact.followers && Array.isArray(contact.followers) && contact.followers.length > 0) {
        log('\n👥 Followers:', 'blue');
        contact.followers.forEach((follower, fIndex) => {
            log(`   ${fIndex + 1}. ${follower.name || follower.id || 'Unnamed'}`, 'dim');
        });
    }
    
    // Display attributions if they exist
    if (contact.attributions && Array.isArray(contact.attributions) && contact.attributions.length > 0) {
        log('\n📊 Attributions:', 'yellow');
        contact.attributions.forEach((attribution, aIndex) => {
            log(`   ${aIndex + 1}. Source: ${attribution.utmSessionSource || 'N/A'}, Medium: ${attribution.medium || 'N/A'}, First: ${attribution.isFirst ? 'Yes' : 'No'}`, 'dim');
        });
    }
    
    // Display DND settings if they exist
    if (contact.dndSettings && typeof contact.dndSettings === 'object') {
        log('\n🔇 DND Settings:', 'red');
        Object.entries(contact.dndSettings).forEach(([channel, settings]) => {
            if (settings && typeof settings === 'object') {
                log(`   ${channel}: Status: ${settings.status || 'N/A'}, Message: ${settings.message || 'N/A'}`, 'dim');
            } else {
                log(`   ${channel}: ${settings}`, 'dim');
            }
        });
    }
    
    // Display additional emails if they exist
    if (contact.additionalEmails && Array.isArray(contact.additionalEmails) && contact.additionalEmails.length > 0) {
        log('\n📧 Additional Emails:', 'yellow');
        contact.additionalEmails.forEach((email, eIndex) => {
            log(`   ${eIndex + 1}. ${email}`, 'dim');
        });
    }
    
    // Display opportunities if they exist
    if (contact.opportunities && Array.isArray(contact.opportunities) && contact.opportunities.length > 0) {
        log('\n💼 Opportunities:', 'green');
        contact.opportunities.forEach((opportunity, oIndex) => {
            log(`   ${oIndex + 1}. ${opportunity.title || opportunity.name || 'Untitled'}`, 'dim');
            if (opportunity.id) log(`      ID: ${opportunity.id}`, 'dim');
            if (opportunity.status) log(`      Status: ${opportunity.status}`, 'dim');
        });
    }
}

// Display contacts information (enhanced version)
function displayContacts(contactsData) {
    log('\n👥 CONTACTS OVERVIEW', 'bright');
    log('='.repeat(50), 'cyan');
    
    // Handle different data structures
    const contacts = contactsData.tagged_contacts || contactsData.contacts?.contacts || contactsData.contacts || contactsData || [];
    const totalContacts = contactsData.total_contacts || contactsData.total || contacts.length;
    
    if (!contacts || contacts.length === 0) {
        log('❌ No contacts found with the specified tag', 'red');
        return;
    }
    
    log(`🎯 Target Tag: "${TARGET_TAG}"`, 'bright');
    log(`📍 Total Contacts in System: ${totalContacts}`, 'blue');
    log(`📊 Tagged Contacts Found: ${contacts.length}`, 'green');
    log('');
    
    // Show summary of first few contacts
    const displayLimit = Math.min(3, contacts.length);
    log(`📋 Showing summary of first ${displayLimit} tagged contacts:`, 'bright');
    
    contacts.slice(0, displayLimit).forEach((contact, index) => {
        log(`${index + 1}. ${contact.firstName || contact.firstNameRaw || 'N/A'} ${contact.lastName || contact.lastNameRaw || 'N/A'}`, 'bright');
        log(`   ID: ${contact.id}`, 'cyan');
        log(`   Email: ${contact.email || 'N/A'}`, 'yellow');
        log(`   Phone: ${contact.phone || 'N/A'}`, 'yellow');
        log(`   Company: ${contact.companyName || contact.businessName || 'N/A'}`, 'blue');
        log(`   Type: ${contact.type || 'N/A'}`, 'green');
        log(`   Source: ${contact.source || 'N/A'}`, 'green');
        
        // Show tags prominently
        if (contact.tags && contact.tags.length > 0) {
            const targetTags = contact.tags.filter(tag => 
                tag.toLowerCase() === TARGET_TAG.toLowerCase()
            );
            if (targetTags.length > 0) {
                log(`   🎯 Target Tags: ${targetTags.join(', ')}`, 'green');
            }
        }
        
        if (contact.dateAdded) {
            const date = new Date(contact.dateAdded);
            log(`   Date Added: ${date.toLocaleDateString()}`, 'green');
        }
        
        log('');
    });
    
    if (contacts.length > displayLimit) {
        log(`... and ${contacts.length - displayLimit} more tagged contacts`, 'dim');
        log('');
    }
}

// Display search metadata
function displaySearchMetadata(contactsData) {
    if (contactsData.search_metadata) {
        log('\n🔍 SEARCH METADATA', 'bright');
        log('='.repeat(30), 'cyan');
        log(`Endpoint: ${contactsData.search_metadata.endpoint}`, 'cyan');
        log(`Method: ${contactsData.search_metadata.method}`, 'cyan');
        log(`Tag Filter: ${contactsData.search_metadata.tag_filter}`, 'cyan');
        log(`Total Contacts: ${contactsData.total_contacts || 'N/A'}`, 'green');
        log(`Tagged Contacts: ${contactsData.tagged_contacts?.length || 0}`, 'green');
    }
}

// Display raw JSON data
function displayRawJSON(contactsData) {
    log('\n🔍 RAW JSON DATA', 'bright');
    log('='.repeat(50), 'cyan');
    log('This is the complete raw data returned from the search API:', 'yellow');
    log('');
    
    try {
        const formattedJSON = JSON.stringify(contactsData, null, 2);
        log(formattedJSON, 'dim');
    } catch (error) {
        log(`❌ Error formatting JSON: ${error.message}`, 'red');
        log('Raw data:', 'dim');
        log(JSON.stringify(contactsData), 'dim');
    }
}

// Display contact statistics
function displayContactStats(contactsData) {
    log('\n📈 CONTACT STATISTICS', 'bright');
    log('='.repeat(30), 'cyan');
    
    // Handle different data structures
    const contacts = contactsData.tagged_contacts || contactsData.contacts?.contacts || contactsData.contacts || contactsData || [];
    
    if (contacts.length === 0) return;
    
    // Count contacts with email
    const withEmail = contacts.filter(c => c.email).length;
    const withoutEmail = contacts.length - withEmail;
    
    // Count contacts with phone
    const withPhone = contacts.filter(c => c.phone).length;
    const withoutPhone = contacts.length - withPhone;
    
    // Count contacts with company
    const withCompany = contacts.filter(c => c.companyName || c.businessName).length;
    const withoutCompany = contacts.length - withCompany;
    
    // Count by type
    const typeCounts = {};
    contacts.forEach(c => {
        const type = c.type || 'Unknown';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    // Count by source
    const sourceCounts = {};
    contacts.forEach(c => {
        const source = c.source || 'Unknown';
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });
    
    log(`📧 With Email: ${withEmail}`, 'green');
    log(`📧 Without Email: ${withoutEmail}`, 'yellow');
    log(`📱 With Phone: ${withPhone}`, 'green');
    log(`📱 Without Phone: ${withoutPhone}`, 'yellow');
    log(`🏢 With Company: ${withCompany}`, 'green');
    log(`🏢 Without Company: ${withoutCompany}`, 'yellow');
    
    log('\n📊 By Type:', 'bright');
    Object.entries(typeCounts).forEach(([type, count]) => {
        log(`   ${type}: ${count}`, 'cyan');
    });
    
    log('\n📊 By Source:', 'bright');
    Object.entries(sourceCounts).forEach(([source, count]) => {
        log(`   ${source}: ${count}`, 'cyan');
    });
    
    // Show recent additions (last 5)
    const recentContacts = contacts
        .filter(c => c.dateAdded)
        .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
        .slice(0, 5);
    
    if (recentContacts.length > 0) {
        log('\n🆕 Recent Additions:', 'bright');
        recentContacts.forEach((contact, index) => {
            const date = new Date(contact.dateAdded);
            log(`   ${index + 1}. ${contact.firstName || contact.firstNameRaw || 'N/A'} ${contact.lastName || contact.lastNameRaw || 'N/A'} - ${date.toLocaleDateString()}`, 'cyan');
        });
    }
}

// Main function
async function main() {
    const showRaw = process.argv.includes('--raw') || process.argv.includes('-r');
    const showComplete = process.argv.includes('--complete') || process.argv.includes('-c');
    const showAll = process.argv.includes('--all') || process.argv.includes('-a');
    const useFallback = process.argv.includes('--fallback') || process.argv.includes('-f');
    
    // Parse limit parameter
    let limit = DEFAULT_LIMIT;
    const limitIndex = process.argv.findIndex(arg => arg === '--limit');
    if (limitIndex !== -1 && process.argv[limitIndex + 1]) {
        const limitValue = parseInt(process.argv[limitIndex + 1]);
        if (!isNaN(limitValue) && limitValue > 0) {
            limit = limitValue;
        } else {
            log('⚠️  Invalid limit value, using default', 'yellow');
        }
    }
    
    try {
        log('🚀 GoHighLevel Contact Fetcher (Standalone)', 'bright');
        log(`🎯 Targeting contacts with tag: "${TARGET_TAG}"`, 'cyan');
        log(`📊 Limit: ${limit} contacts per request`, 'blue');
        log('Connecting to running server...\n');
        
        // Step 1: Check server health
        log('1. Checking server health...', 'blue');
        const healthData = await checkServerHealth();
        log('✅ Server is healthy', 'green');
        
        // Step 2: Check OAuth status
        log('\n2. Checking authentication...', 'blue');
        const oauthData = await checkOAuthStatus();
        
        if (oauthData.authenticated) {
            log(`✅ Authenticated for location: ${oauthData.locationId}`, 'green');
            if (oauthData.expiresAt) {
                const expiresDate = new Date(oauthData.expiresAt);
                log(`⏰ Expires: ${expiresDate.toLocaleString()}`, 'yellow');
            }
        } else {
            log('❌ Not authenticated. Please authenticate first.', 'red');
            return;
        }
        
        // Step 3: Fetch contacts using search endpoint
        log('\n3. Searching for tagged contacts...', 'blue');
        let contactsData;
        
        if (useFallback) {
            log('⚠️  Using fallback method (fetch all then filter)', 'yellow');
            contactsData = await getAllContacts();
            // Filter by tag in the fallback data
            if (contactsData.contacts && Array.isArray(contactsData.contacts)) {
                const taggedContacts = contactsData.contacts.filter(contact => {
                    if (contact.tags && Array.isArray(contact.tags)) {
                        return contact.tags.some(tag => 
                            tag.toLowerCase() === TARGET_TAG.toLowerCase()
                        );
                    }
                    return false;
                });
                contactsData.tagged_contacts = taggedContacts;
                contactsData.total_contacts = contactsData.contacts.length;
            }
        } else {
            try {
                contactsData = await searchContactsByTag(limit, oauthData);
            } catch (searchError) {
                log(`⚠️  Search endpoint failed: ${searchError.message}`, 'yellow');
                log('🔄 Falling back to fetch all contacts method...', 'yellow');
                contactsData = await getAllContacts();
                // Filter by tag in the fallback data
                if (contactsData.contacts && Array.isArray(contactsData.contacts)) {
                    const taggedContacts = contactsData.contacts.filter(contact => {
                        if (contact.tags && Array.isArray(contact.tags)) {
                            return contact.tags.some(tag => 
                                tag.toLowerCase() === TARGET_TAG.toLowerCase()
                            );
                        }
                        return false;
                    });
                    contactsData.tagged_contacts = taggedContacts;
                    contactsData.total_contacts = contactsData.contacts.length;
                }
            }
        }
        
        log('✅ Contacts fetched successfully', 'green');
        
        // Step 4: Display results based on options
        if (showComplete || showAll) {
            // Show complete contact objects
            const contacts = contactsData.tagged_contacts || contactsData.contacts?.contacts || contactsData.contacts || contactsData || [];
            contacts.forEach((contact, index) => {
                displayCompleteContact(contact, index);
            });
        } else {
            // Show summary view
            displayContacts(contactsData);
        }
        
        // Show search metadata if available
        displaySearchMetadata(contactsData);
        
        // Always show statistics
        displayContactStats(contactsData);
        
        // Show raw JSON if requested
        if (showRaw || showAll) {
            displayRawJSON(contactsData);
        }
        
        log('\n🎉 Contact fetch completed successfully!', 'bright');
        
    } catch (error) {
        log(`\n❌ Error: ${error.message}`, 'red');
        process.exit(1);
    }
}

// Help function
function showHelp() {
    log('\n📖 GoHighLevel Contact Fetcher - Help', 'bright');
    log('='.repeat(50), 'cyan');
    log(`\nThis script fetches contacts with the tag "${TARGET_TAG}" from your GoHighLevel location.`);
    log('It uses the search endpoint for efficiency and falls back to fetch all if needed.');
    
    log('\n💡 Available commands:', 'yellow');
    log('   node get-contacts-standalone.js', 'cyan');
    log('   node get-contacts-standalone.js --complete', 'cyan');
    log('   node get-contacts-standalone.js --raw', 'cyan');
    log('   node get-contacts-standalone.js --all', 'cyan');
    log('   node get-contacts-standalone.js --fallback', 'cyan');
    log('   node get-contacts-standalone.js --limit <number>', 'cyan');
    
    log('\n📋 Options:', 'yellow');
    log('   --complete, -c    Show complete contact objects with all fields', 'cyan');
    log('   --raw, -r         Show raw JSON data returned from API', 'cyan');
    log('   --all, -a         Show everything (complete objects + raw JSON)', 'cyan');
    log('   --fallback, -f    Use fallback method (fetch all then filter)', 'cyan');
    log(`   --limit <number>  Set the limit for the search endpoint (default: ${DEFAULT_LIMIT})`, 'cyan');
    log('   --help, -h        Show this help message', 'cyan');
    
    log('\n🎯 What you get:', 'yellow');
    log(`   • Contacts filtered by tag: "${TARGET_TAG}"`, 'cyan');
    log('   • Uses efficient search endpoint when possible', 'cyan');
    log('   • Complete contact objects with all fields', 'cyan');
    log('   • Raw JSON data from API', 'cyan');
    log('   • Contact statistics and analytics', 'cyan');
    log('   • Recent contact additions', 'cyan');
    
    log('\n🔧 Requirements:', 'yellow');
    log('   • Your server must be running (ghl-oauth-server.js)', 'cyan');
    log('   • You must be authenticated with GoHighLevel', 'cyan');
    log('   • contacts.readonly scope required', 'cyan');
    
    log('\nExamples:', 'yellow');
    log('   node get-contacts-standalone.js', 'cyan');
    log('   node get-contacts-standalone.js --complete', 'cyan');
    log('   node get-contacts-standalone.js --raw', 'cyan');
    log('   node get-contacts-standalone.js --all', 'cyan');
    log('   node get-contacts-standalone.js --fallback', 'cyan');
    log('   node get-contacts-standalone.js --limit 50', 'cyan');
    
    log('\nNote: This script uses the GoHighLevel search endpoint for efficiency.', 'blue');
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
}

// Run the main function
main().catch(error => {
    log(`\n💥 Fatal error: ${error.message}`, 'red');
    process.exit(1);
});