/**
 * GoHighLevel Data Formatter
 * Formats GoHighLevel opportunity data into clean, readable plain text
 */

// Sample data structure (you can replace this with your actual data)
const sampleData = [
  {
    "opportunities": [
      {
        "id": "LChKJfkKwslAfM437Doc",
        "name": "Project Kanes Bookstore",
        "monetaryValue": 0,
        "pipelineId": "uR2CMkTiwqoUOYuf8oGR",
        "pipelineStageId": "0a04dce0-2447-4f9a-90f7-8d5f8525b5ef",
        "pipelineStageUId": "0a04dce0-2447-4f9a-90f7-8d5f8525b5ef",
        "assignedTo": null,
        "status": "open",
        "source": "payment_link",
        "lastStatusChangeAt": "2025-08-05T03:48:05.977Z",
        "lastStageChangeAt": "2025-08-05T03:48:05.977Z",
        "createdAt": "2025-08-05T03:48:05.977Z",
        "updatedAt": "2025-08-05T03:48:05.977Z",
        "indexVersion": 1,
        "contactId": "XcHjEXpKHcPshR1YAq9u",
        "locationId": "QLyYYRoOhCg65lKW9HDX",
        "customFields": [],
        "lostReasonId": null,
        "followers": [],
        "relations": [
          {
            "associationId": "OPPORTUNITIES_CONTACTS_ASSOCIATION",
            "relationId": "LChKJfkKwslAfM437Doc",
            "primary": true,
            "objectKey": "contact",
            "recordId": "XcHjEXpKHcPshR1YAq9u",
            "fullName": "KD Emanuel",
            "contactName": "KD Emanuel",
            "companyName": "Kane's Komet Bookstore",
            "email": "kdemanuel3@gmail.com",
            "phone": "+14707750910",
            "tags": [
              "done for you services",
              "review link clicked",
              "haircut prospect",
              "general incoming sms contact",
              "web dev & service client"
            ],
            "attributed": null
          }
        ],
        "contact": {
          "id": "XcHjEXpKHcPshR1YAq9u",
          "name": "KD Emanuel",
          "companyName": "Kane's Komet Bookstore",
          "email": "kdemanuel3@gmail.com",
          "phone": "+14707750910",
          "tags": [
            "done for you services",
            "review link clicked",
            "haircut prospect",
            "general incoming sms contact",
            "web dev & service client"
          ]
        }
      }
    ]
  }
];

/**
 * Format a date string to a readable format
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date string
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return dateString;
  }
}

/**
 * Format monetary value
 * @param {number} value - Monetary value
 * @returns {string} - Formatted currency string
 */
function formatCurrency(value) {
  if (value === null || value === undefined || value === 0) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

/**
 * Format tags array into readable string
 * @param {Array} tags - Array of tags
 * @returns {string} - Formatted tags string
 */
function formatTags(tags) {
  if (!tags || tags.length === 0) return 'No tags';
  return tags.map(tag => `• ${tag}`).join('\n');
}

/**
 * Format a single opportunity into readable text
 * @param {Object} opportunity - Opportunity object
 * @returns {string} - Formatted opportunity text
 */
function formatOpportunity(opportunity) {
  const contact = opportunity.contact || opportunity.relations?.[0] || {};
  
  return `📋 OPPORTUNITY DETAILS
${'='.repeat(50)}

🎯 Project: ${opportunity.name || 'N/A'}
💰 Value: ${formatCurrency(opportunity.monetaryValue)}
📊 Status: ${opportunity.status?.toUpperCase() || 'N/A'}
🔗 Source: ${opportunity.source || 'N/A'}

👤 CONTACT INFORMATION
${'-'.repeat(30)}
Name: ${contact.fullName || contact.contactName || contact.name || 'N/A'}
Company: ${contact.companyName || 'N/A'}
Email: ${contact.email || 'N/A'}
Phone: ${contact.phone || 'N/A'}

🏷️ TAGS
${'-'.repeat(30)}
${formatTags(contact.tags)}

📅 TIMELINE
${'-'.repeat(30)}
Created: ${formatDate(opportunity.createdAt)}
Last Updated: ${formatDate(opportunity.updatedAt)}
Last Status Change: ${formatDate(opportunity.lastStatusChangeAt)}
Last Stage Change: ${formatDate(opportunity.lastStageChangeAt)}

🔧 TECHNICAL DETAILS
${'-'.repeat(30)}
Opportunity ID: ${opportunity.id}
Contact ID: ${opportunity.contactId}
Pipeline ID: ${opportunity.pipelineId}
Stage ID: ${opportunity.pipelineStageId}
Assigned To: ${opportunity.assignedTo || 'Unassigned'}

${'='.repeat(50)}
`;
}

/**
 * Format the entire data structure
 * @param {Array} data - Array of opportunity data
 * @returns {string} - Formatted text output
 */
function formatGHLData(data) {
  if (!data || data.length === 0) {
    return 'No data to format.';
  }

  let output = `🚀 GOHIGHLEVEL OPPORTUNITIES REPORT
${'='.repeat(60)}
Generated: ${formatDate(new Date())}
Total Opportunities: ${data.reduce((total, item) => total + (item.opportunities?.length || 0), 0)}

${'='.repeat(60)}

`;

  data.forEach((item, index) => {
    if (item.opportunities && item.opportunities.length > 0) {
      output += `📁 GROUP ${index + 1}\n`;
      output += `${'='.repeat(40)}\n\n`;
      
      item.opportunities.forEach((opportunity, oppIndex) => {
        output += `Opportunity ${oppIndex + 1}:\n`;
        output += formatOpportunity(opportunity);
        output += '\n';
      });
    }
  });

  return output;
}

/**
 * Display formatted data in console
 * @param {Array} data - Data to format
 */
function displayFormattedData(data) {
  console.log(formatGHLData(data));
}

/**
 * Copy formatted data to clipboard (if supported)
 * @param {Array} data - Data to format
 */
function copyFormattedData(data) {
  const formattedText = formatGHLData(data);
  
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(formattedText).then(() => {
      console.log('✅ Formatted data copied to clipboard!');
    }).catch(err => {
      console.error('❌ Failed to copy to clipboard:', err);
      console.log('📋 Formatted data:', formattedText);
    });
  } else {
    console.log('📋 Formatted data (copy manually):');
    console.log(formattedText);
  }
}

/**
 * Save formatted data as a text file
 * @param {Array} data - Data to format
 * @param {string} filename - Name of the file to save
 */
function saveFormattedData(data, filename = 'ghl-opportunities.txt') {
  const formattedText = formatGHLData(data);
  
  // Browser environment
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([formattedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`✅ Data saved as ${filename}`);
  } 
  // Node.js environment
  else if (typeof require !== 'undefined') {
    const fs = require('fs');
    try {
      fs.writeFileSync(filename, formattedText, 'utf8');
      console.log(`✅ Data saved as ${filename}`);
    } catch (error) {
      console.error(`❌ Error saving file: ${error.message}`);
      console.log('📋 Formatted data:', formattedText);
    }
  }
  // Fallback
  else {
    console.log('📋 Formatted data (copy manually):');
    console.log(formattedText);
  }
}

// Example usage functions
function runExamples() {
  console.log('🔍 Running GoHighLevel Data Formatter Examples...\n');
  
  // Example 1: Display in console
  console.log('📊 Example 1: Console Display');
  console.log('='.repeat(40));
  displayFormattedData(sampleData);
  
  // Example 2: Copy to clipboard
  console.log('\n📋 Example 2: Copy to Clipboard');
  console.log('='.repeat(40));
  copyFormattedData(sampleData);
  
  // Example 3: Save as file
  console.log('\n💾 Example 3: Save as File');
  console.log('='.repeat(40));
  saveFormattedData(sampleData, 'sample-opportunities.txt');
}

// Browser environment functions
if (typeof window !== 'undefined') {
  // Make functions available globally
  window.GHLFormatter = {
    formatData: formatGHLData,
    displayData: displayFormattedData,
    copyData: copyFormattedData,
    saveData: saveFormattedData,
    runExamples: runExamples
  };
  
  console.log('🚀 GoHighLevel Data Formatter loaded!');
  console.log('Use GHLFormatter.runExamples() to see examples');
  console.log('Or use GHLFormatter.formatData(yourData) to format your data');
}

// Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatGHLData,
    displayFormattedData,
    copyFormattedData,
    saveFormattedData,
    runExamples
  };
  
  // Add Node.js specific file writing function
  if (typeof require !== 'undefined') {
    const fs = require('fs');
    
    module.exports.writeToFile = function(data, filename = 'ghl-opportunities.txt') {
      const formattedText = formatGHLData(data);
      try {
        fs.writeFileSync(filename, formattedText, 'utf8');
        console.log(`✅ Data written to ${filename}`);
        return true;
      } catch (error) {
        console.error(`❌ Error writing file: ${error.message}`);
        return false;
      }
    };
  }
}

// Auto-run examples if this is the main module
if (typeof require !== 'undefined' && require.main === module) {
  runExamples();
} 