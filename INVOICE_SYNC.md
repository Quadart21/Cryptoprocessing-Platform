# Invoice Status Synchronization

## Overview

The invoice status synchronization system ensures that invoice statuses (expired, paid, etc.) are automatically updated from the CryptoCash provider. This system includes:

1. **Webhook callback** - CryptoCash sends automatic callbacks to your server when invoice status changes (recommended)
2. **Manual sync** - Admin and merchant users can manually sync individual invoices
3. **Background sync** - Celery worker automatically syncs pending/paid invoices every 5 minutes

## Architecture

### Backend Components

- **Webhook Endpoint** (`backend/app/api/routes/internal.py`) - `/internal/webhook/crypto-cash` receives status updates from CryptoCash
- **Celery App** (`backend/app/celery_app.py`) - Celery configuration with beat schedule
- **Celery Tasks** (`backend/app/tasks/invoice_sync.py`) - Background tasks for invoice synchronization
- **Admin API** (`backend/app/api/routes/admin.py`) - `/admin/invoices/{invoice_id}/sync` endpoint
- **Client API** (`backend/app/api/routes/client.py`) - `/client/invoices/{invoice_id}/sync` endpoint

### Frontend Components

- **Admin API** (`frontend/src/api/admin.ts`) - `syncAdminInvoice` function
- **Client API** (`frontend/src/api/client.ts`) - `syncClientInvoice` function
- **Admin Dashboard** - Sync button in invoice cards
- **Merchant Dashboard** - Sync button in invoice cards

## Configuration

### Environment Variables

The following environment variables are required:

```bash
# Redis connection (required for Celery)
REDIS_URL=redis://localhost:6379/0

# CryptoCash API credentials
CRYPTO_CASH_API_BASE_URL=https://api.crypto-cash.world
CRYPTO_CASH_PUBLIC_KEY=your_public_key
CRYPTO_CASH_SECRET_KEY=your_secret_key

# Public API base URL (for CryptoCash webhook callback)
# This is the URL where CryptoCash will send status update callbacks
PUBLIC_API_BASE_URL=https://your-domain.com
```

### Docker Services

The `docker-compose.yml` includes the following services:

- **redis** - Redis server for Celery broker and backend
- **celery-worker** - Celery worker that processes background tasks
- **celery-beat** - Celery beat scheduler that triggers periodic tasks

## Webhook Configuration (Recommended)

CryptoCash will automatically send webhook callbacks to your server when invoice status changes. To enable this:

1. Set `PUBLIC_API_BASE_URL` to your public server URL (e.g., `https://api.yourdomain.com`)
2. Make sure your server is accessible from the internet
3. CryptoCash will automatically use this URL when creating invoices

The webhook endpoint is: `{PUBLIC_API_BASE_URL}/internal/webhook/crypto-cash`

### Webhook Security

The webhook endpoint validates incoming requests using:
- Signature verification (if configured)
- Timestamp validation to prevent replay attacks

## Usage

### Automatic Webhook Updates (Recommended)

When webhook is configured, CryptoCash will automatically send status updates to your server. No manual intervention required.

### Manual Sync (Admin)

1. Navigate to the Admin Dashboard
2. Go to the Invoices section
3. Click the "Sync" button on any invoice card
4. The invoice status will be updated from CryptoCash

### Manual Sync (Merchant)

1. Navigate to the Merchant Dashboard
2. Go to the Invoices section
3. Click the "Sync" button on any invoice card
4. The invoice status will be updated from CryptoCash

### Automatic Background Sync

The system automatically syncs all pending and paid invoices every 5 minutes via Celery beat. No manual intervention required.

## API Endpoints

### Webhook Endpoint (Receives CryptoCash callbacks)

```
POST /internal/webhook/crypto-cash
```

**Response:**
```json
{
  "id": "invoice_id",
  "status": "paid",
  "amount": "100.00",
  "currency": "USD",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### Admin Sync Endpoint

```
POST /api/v1/admin/invoices/{invoice_id}/sync
```

### Client Sync Endpoint

```
POST /api/v1/client/invoices/{invoice_id}/sync
```

## Celery Tasks

### sync_all_pending_invoices

Runs every 5 minutes to sync all invoices with status "pending" or "paid".

**Task:** `app.tasks.invoice_sync.sync_all_pending_invoices`

### sync_single_invoice

Manually sync a single invoice by ID.

**Task:** `app.tasks.invoice_sync.sync_single_invoice`

**Parameters:**
- `invoice_id` (str) - The ID of the invoice to sync

## Running the System

### Development

1. Start Redis:
```bash
docker-compose up -d redis
```

2. Start Celery worker:
```bash
cd backend
celery -A app.celery_app worker --loglevel=info
```

3. Start Celery beat:
```bash
cd backend
celery -A app.celery_app beat --loglevel=info
```

4. Start the FastAPI application:
```bash
cd backend
uvicorn app.main:app --reload
```

### Production (Docker)

```bash
docker-compose up -d
```

This will start all services including:
- PostgreSQL database
- Redis server
- Celery worker
- Celery beat scheduler
- FastAPI application

## Monitoring

### Celery Flower (Optional)

To monitor Celery tasks, you can add Flower to your setup:

```bash
pip install flower
celery -A app.celery_app flower
```

Then visit `http://localhost:5555` to see task status and execution history.

## Troubleshooting

### Webhook not receiving callbacks

1. Check that `PUBLIC_API_BASE_URL` is set correctly
2. Verify your server is accessible from the internet
3. Check server logs for incoming webhook requests

### Celery worker not connecting to Redis

Check that Redis is running and accessible:
```bash
docker-compose ps redis
docker-compose logs redis
```

### Tasks not executing

Check Celery worker logs:
```bash
docker-compose logs celery-worker | grep invoice_sync
```

### Invoice status not updating

1. Check CryptoCash API credentials are correct
2. Verify the invoice ID exists in CryptoCash
3. Check the sync logs for errors:
```bash
docker-compose logs celery-worker | grep invoice_sync
```

## Security Considerations

- All sync endpoints require authentication
- Admin sync endpoint requires admin role
- Client sync endpoint requires merchant role
- CryptoCash API credentials should be stored securely in environment variables
- Never commit secrets to version control
- Webhook endpoint validates signatures to prevent spoofed callbacks