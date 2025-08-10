# Pipeline Routes

This directory contains the separated route modules for the GoHighLevel integration server.

## Pipeline Routes (`/routes/pipelines.js`)

The pipeline routes provide endpoints for managing and querying GoHighLevel pipelines, opportunities, contacts, and tasks.

### Available Endpoints

#### `GET /pipelines`

Returns all available pipelines for the authenticated location.

**Response:**

```json
{
  "success": true,
  "location_id": "QLyYYRoOhCg65lKW9HDX",
  "pipelines": [...]
}
```

#### `GET /pipelines/:pipelineName/tasks`

Returns all tasks associated with opportunities in a specific pipeline.

**Parameters:**

- `pipelineName`: The name of the pipeline (e.g., "Software Development Pipeline")

**Response:**

```json
{
  "success": true,
  "location_id": "QLyYYRoOhCg65lKW9HDX",
  "pipeline": {...},
  "opportunities_count": 5,
  "tasks": [...],
  "tasks_count": 12
}
```

#### `GET /pipelines/:pipelineName/opportunities`

Returns all opportunities in a specific pipeline.

**Parameters:**

- `pipelineName`: The name of the pipeline

**Response:**

```json
{
  "success": true,
  "location_id": "QLyYYRoOhCg65lKW9HDX",
  "pipeline": {...},
  "opportunities": [...],
  "opportunities_count": 5
}
```

#### `GET /pipelines/:pipelineName/contacts`

Returns all contacts associated with opportunities in a specific pipeline.

**Parameters:**

- `pipelineName`: The name of the pipeline

**Response:**

```json
{
  "success": true,
  "location_id": "QLyYYRoOhCg65lKW9HDX",
  "pipeline": {...},
  "contacts": [...],
  "total": 8
}
```

### Usage Examples

#### Get Software Development Pipeline Contacts

```bash
GET /pipelines/Software%20Development%20Pipeline/contacts
```

#### Get Tasks for Sales Pipeline

```bash
GET /pipelines/Sales%20Pipeline/tasks
```

#### Get All Pipelines

```bash
GET /pipelines
```

### Migration from Old Endpoints

The following old endpoints have been replaced:

- **Old:** `GET /contacts` (Software Development Pipeline specific)
- **New:** `GET /pipelines/Software%20Development%20Pipeline/contacts`

- **Old:** `GET /pipeline-tasks/:pipelineName`
- **New:** `GET /pipelines/:pipelineName/tasks`

### Architecture Notes

- Routes are separated from the main server for better organization
- Token functions are injected from the main server to maintain security
- All endpoints require valid authentication tokens
- Error handling is consistent across all pipeline endpoints
- Pipeline names are matched case-insensitively for better user experience
