# Report Email Configuration

## Current State

Field Log New Drop and Conduit Pull billing packets use a hardcoded Resend target:

- Comcast_Billing@itgcomm.com

This is acceptable for the initial billing packet workflow.

## Future Task

Create an admin-controlled report email routing configuration so automated report delivery can scale safely.

## Configuration Needs

- Report key / category key
- To recipients
- CC recipients
- BCC recipients
- From identity
- Enabled / disabled
- Auto-send allowed
- Manual resend allowed
- Duplicate-send policy
- Manager/admin resend permissions
- Audit logging retained per send attempt

## First Candidate

Field Log billing packets:

- new_drop
- conduit_pull_install
