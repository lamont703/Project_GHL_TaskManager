const { MongoClient } = require('mongodb');
const { Pool } = require('pg');
const mysql = require('mysql2/promise');

// Database connection configuration
class DatabaseConfig {
    constructor() {
        this.dbType = process.env.DB_TYPE || 'mongodb';
        this.connection = null;
        this.pool = null;
    }

    async connect() {
        switch (this.dbType) {
            case 'mongodb':
                return await this.connectMongoDB();
            case 'postgresql':
                return await this.connectPostgreSQL();
            case 'mysql':
                return await this.connectMySQL();
            default:
                throw new Error('Unsupported database type');
        }
    }

    async connectMongoDB() {
        try {
            this.connection = new MongoClient(process.env.MONGODB_URI);
            await this.connection.connect();
            console.log('Connected to MongoDB');
            return this.connection.db();
        } catch (error) {
            console.error('MongoDB connection error:', error);
            throw error;
        }
    }

    async connectPostgreSQL() {
        try {
            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });
            await this.pool.query('SELECT NOW()');
            console.log('Connected to PostgreSQL');
            return this.pool;
        } catch (error) {
            console.error('PostgreSQL connection error:', error);
            throw error;
        }
    }

    async connectMySQL() {
        try {
            this.pool = mysql.createPool({
                host: process.env.MYSQL_HOST,
                port: process.env.MYSQL_PORT,
                user: process.env.MYSQL_USER,
                password: process.env.MYSQL_PASSWORD,
                database: process.env.MYSQL_DATABASE,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });
            await this.pool.execute('SELECT 1');
            console.log('Connected to MySQL');
            return this.pool;
        } catch (error) {
            console.error('MySQL connection error:', error);
            throw error;
        }
    }

    // Token management functions
    async storeTokens(locationId, accessToken, refreshToken, expiresIn) {
        const expirationTime = new Date(Date.now() + expiresIn * 1000);
        
        switch (this.dbType) {
            case 'mongodb':
                return await this.storeTokensMongoDB(locationId, accessToken, refreshToken, expirationTime);
            case 'postgresql':
                return await this.storeTokensPostgreSQL(locationId, accessToken, refreshToken, expirationTime);
            case 'mysql':
                return await this.storeTokensMySQL(locationId, accessToken, refreshToken, expirationTime);
        }
    }

    async storeTokensMongoDB(locationId, accessToken, refreshToken, expirationTime) {
        const db = await this.connect();
        const collection = db.collection('ghl_integrations');
        
        return await collection.updateOne(
            { location_id: locationId },
            {
                $set: {
                    location_id: locationId,
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    expires_at: expirationTime,
                    updated_at: new Date()
                },
                $setOnInsert: {
                    created_at: new Date()
                }
            },
            { upsert: true }
        );
    }

    async storeTokensPostgreSQL(locationId, accessToken, refreshToken, expirationTime) {
        const query = `
            INSERT INTO ghl_integrations (location_id, access_token, refresh_token, expires_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (location_id)
            DO UPDATE SET
                access_token = $2,
                refresh_token = $3,
                expires_at = $4,
                updated_at = CURRENT_TIMESTAMP
        `;
        
        return await this.pool.query(query, [locationId, accessToken, refreshToken, expirationTime]);
    }

    async storeTokensMySQL(locationId, accessToken, refreshToken, expirationTime) {
        const query = `
            INSERT INTO ghl_integrations (location_id, access_token, refresh_token, expires_at)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                access_token = VALUES(access_token),
                refresh_token = VALUES(refresh_token),
                expires_at = VALUES(expires_at),
                updated_at = CURRENT_TIMESTAMP
        `;
        
        return await this.pool.execute(query, [locationId, accessToken, refreshToken, expirationTime]);
    }

    async getTokens(locationId) {
        switch (this.dbType) {
            case 'mongodb':
                return await this.getTokensMongoDB(locationId);
            case 'postgresql':
                return await this.getTokensPostgreSQL(locationId);
            case 'mysql':
                return await this.getTokensMySQL(locationId);
        }
    }

    async getTokensMongoDB(locationId) {
        const db = await this.connect();
        const collection = db.collection('ghl_integrations');
        
        const result = await collection.findOne({ location_id: locationId });
        
        if (!result) return null;
        
        return {
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            expires_at: result.expires_at
        };
    }

    async getTokensPostgreSQL(locationId) {
        const query = 'SELECT access_token, refresh_token, expires_at FROM ghl_integrations WHERE location_id = $1';
        const result = await this.pool.query(query, [locationId]);
        
        if (result.rows.length === 0) return null;
        
        return result.rows[0];
    }

    async getTokensMySQL(locationId) {
        const query = 'SELECT access_token, refresh_token, expires_at FROM ghl_integrations WHERE location_id = ?';
        const [rows] = await this.pool.execute(query, [locationId]);
        
        if (rows.length === 0) return null;
        
        return rows[0];
    }

    async storeLocationDetails(locationId, locationData) {
        switch (this.dbType) {
            case 'mongodb':
                return await this.storeLocationDetailsMongoDB(locationId, locationData);
            case 'postgresql':
                return await this.storeLocationDetailsPostgreSQL(locationId, locationData);
            case 'mysql':
                return await this.storeLocationDetailsMySQL(locationId, locationData);
        }
    }

    async storeLocationDetailsMongoDB(locationId, locationData) {
        const db = await this.connect();
        const collection = db.collection('ghl_integrations');
        
        return await collection.updateOne(
            { location_id: locationId },
            {
                $set: {
                    location_name: locationData.name,
                    location_email: locationData.email,
                    location_phone: locationData.phone,
                    location_address: locationData.address,
                    updated_at: new Date()
                }
            }
        );
    }

    async storeLocationDetailsPostgreSQL(locationId, locationData) {
        const query = `
            UPDATE ghl_integrations 
            SET location_name = $2, updated_at = CURRENT_TIMESTAMP 
            WHERE location_id = $1
        `;
        
        return await this.pool.query(query, [locationId, locationData.name]);
    }

    async storeLocationDetailsMySQL(locationId, locationData) {
        const query = `
            UPDATE ghl_integrations 
            SET location_name = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE location_id = ?
        `;
        
        return await this.pool.execute(query, [locationData.name, locationId]);
    }

    async storeTaskMapping(locationId, ghlTaskId, localTaskId, syncDirection = 'bidirectional') {
        switch (this.dbType) {
            case 'mongodb':
                return await this.storeTaskMappingMongoDB(locationId, ghlTaskId, localTaskId, syncDirection);
            case 'postgresql':
                return await this.storeTaskMappingPostgreSQL(locationId, ghlTaskId, localTaskId, syncDirection);
            case 'mysql':
                return await this.storeTaskMappingMySQL(locationId, ghlTaskId, localTaskId, syncDirection);
        }
    }

    async storeTaskMappingMongoDB(locationId, ghlTaskId, localTaskId, syncDirection) {
        const db = await this.connect();
        const collection = db.collection('task_mappings');
        
        return await collection.insertOne({
            location_id: locationId,
            ghl_task_id: ghlTaskId,
            local_task_id: localTaskId,
            sync_direction: syncDirection,
            created_at: new Date(),
            updated_at: new Date()
        });
    }

    async storeTaskMappingPostgreSQL(locationId, ghlTaskId, localTaskId, syncDirection) {
        const query = `
            INSERT INTO task_mappings (location_id, ghl_task_id, local_task_id, sync_direction)
            VALUES ($1, $2, $3, $4)
        `;
        
        return await this.pool.query(query, [locationId, ghlTaskId, localTaskId, syncDirection]);
    }

    async storeTaskMappingMySQL(locationId, ghlTaskId, localTaskId, syncDirection) {
        const query = `
            INSERT INTO task_mappings (location_id, ghl_task_id, local_task_id, sync_direction)
            VALUES (?, ?, ?, ?)
        `;
        
        return await this.pool.execute(query, [locationId, ghlTaskId, localTaskId, syncDirection]);
    }

    async logSync(locationId, syncType, status, details = null) {
        switch (this.dbType) {
            case 'mongodb':
                return await this.logSyncMongoDB(locationId, syncType, status, details);
            case 'postgresql':
                return await this.logSyncPostgreSQL(locationId, syncType, status, details);
            case 'mysql':
                return await this.logSyncMySQL(locationId, syncType, status, details);
        }
    }

    async logSyncMongoDB(locationId, syncType, status, details) {
        const db = await this.connect();
        const collection = db.collection('sync_logs');
        
        return await collection.insertOne({
            location_id: locationId,
            sync_type: syncType,
            status: status,
            details: details,
            created_at: new Date()
        });
    }

    async logSyncPostgreSQL(locationId, syncType, status, details) {
        const query = `
            INSERT INTO sync_logs (location_id, sync_type, status, details)
            VALUES ($1, $2, $3, $4)
        `;
        
        return await this.pool.query(query, [locationId, syncType, status, details]);
    }

    async logSyncMySQL(locationId, syncType, status, details) {
        const query = `
            INSERT INTO sync_logs (location_id, sync_type, status, details)
            VALUES (?, ?, ?, ?)
        `;
        
        return await this.pool.execute(query, [locationId, syncType, status, details]);
    }

    async deleteIntegration(locationId) {
        switch (this.dbType) {
            case 'mongodb':
                return await this.deleteIntegrationMongoDB(locationId);
            case 'postgresql':
                return await this.deleteIntegrationPostgreSQL(locationId);
            case 'mysql':
                return await this.deleteIntegrationMySQL(locationId);
        }
    }

    async deleteIntegrationMongoDB(locationId) {
        const db = await this.connect();
        
        // Delete from all collections
        await db.collection('ghl_integrations').deleteOne({ location_id: locationId });
        await db.collection('task_mappings').deleteMany({ location_id: locationId });
        await db.collection('sync_logs').deleteMany({ location_id: locationId });
        
        return { success: true };
    }

    async deleteIntegrationPostgreSQL(locationId) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            await client.query('DELETE FROM sync_logs WHERE location_id = $1', [locationId]);
            await client.query('DELETE FROM task_mappings WHERE location_id = $1', [locationId]);
            await client.query('DELETE FROM ghl_integrations WHERE location_id = $1', [locationId]);
            
            await client.query('COMMIT');
            return { success: true };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async deleteIntegrationMySQL(locationId) {
        const connection = await this.pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            await connection.execute('DELETE FROM sync_logs WHERE location_id = ?', [locationId]);
            await connection.execute('DELETE FROM task_mappings WHERE location_id = ?', [locationId]);
            await connection.execute('DELETE FROM ghl_integrations WHERE location_id = ?', [locationId]);
            
            await connection.commit();
            return { success: true };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async close() {
        if (this.connection) {
            await this.connection.close();
        }
        if (this.pool) {
            await this.pool.end();
        }
    }
}

module.exports = DatabaseConfig; 