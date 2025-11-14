# Security Setup Guide

## 🔐 Critical Security Configuration

### 1. Generate Encryption Key

**REQUIRED for production!** This encrypts Plaid access tokens in the database.

```bash
# Generate a secure 256-bit key
openssl rand -base64 32
```

Add to your `.env` file:
```env
ENCRYPTION_KEY=your_generated_key_here
```

**⚠️ IMPORTANT:**
- Never commit this key to git
- Store it securely (use a secrets manager in production)
- If you lose this key, you cannot decrypt existing tokens
- Rotate keys periodically

### 2. Environment Variables Security

**Never commit these to git:**

```env
# Supabase (required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Only for admin ops

# Plaid (required)
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret

# Encryption (required for production)
ENCRYPTION_KEY=your_encryption_key
```

### 3. Verify Security Features

✅ **Row Level Security (RLS)** - Enabled on all tables
✅ **Access Token Encryption** - Plaid tokens encrypted at rest
✅ **Authentication Required** - All endpoints require valid JWT
✅ **User Isolation** - Users can only access their own data
✅ **Error Sanitization** - Internal errors not exposed to clients

## 🛡️ Security Best Practices

### Database Security

1. **RLS Policies** - Already configured in `supabase/schema.sql`
   - Users can only SELECT/INSERT/UPDATE/DELETE their own data
   - Policies enforced at database level

2. **Encryption at Rest**
   - Plaid access tokens encrypted with AES-256-GCM
   - Uses PBKDF2 with 100,000 iterations
   - Salt and IV stored with encrypted data

### API Security

1. **Authentication**
   - All endpoints require `Authorization: Bearer <token>` header
   - Tokens validated via Supabase Auth
   - Invalid tokens return 401 Unauthorized

2. **Input Validation**
   - Validate all user inputs
   - Sanitize error messages (don't expose internals)
   - Use parameterized queries (Supabase handles this)

3. **Error Handling**
   - Generic error messages to clients
   - Detailed errors logged server-side only
   - No stack traces in production responses

### Frontend Security

1. **Token Storage**
   - Currently: localStorage (acceptable for MVP)
   - **Production recommendation**: Use httpOnly cookies
   - Consider sessionStorage for better XSS protection

2. **HTTPS**
   - Always use HTTPS in production
   - Enforce HTTPS redirects
   - Use HSTS headers

3. **Content Security Policy (CSP)**
   - Add CSP headers to prevent XSS
   - Restrict script sources
   - Block inline scripts

## 🔍 Security Checklist

Before deploying to production:

- [ ] `ENCRYPTION_KEY` is set and secure
- [ ] All environment variables are in secrets manager
- [ ] HTTPS is enforced
- [ ] RLS policies are active (check Supabase dashboard)
- [ ] Error messages don't expose sensitive info
- [ ] Rate limiting is implemented (recommended)
- [ ] Logging doesn't include tokens/keys
- [ ] Database backups are encrypted
- [ ] Access logs are monitored
- [ ] Security headers are configured (CSP, HSTS, etc.)

## 🚨 Security Incident Response

If you suspect a security breach:

1. **Immediately rotate all keys:**
   - `ENCRYPTION_KEY` (requires re-encrypting all tokens)
   - `PLAID_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. **Revoke compromised tokens:**
   - Revoke Plaid access tokens via Plaid dashboard
   - Invalidate Supabase sessions

3. **Audit access logs:**
   - Check Supabase logs for unauthorized access
   - Review API access patterns

4. **Notify affected users:**
   - Inform users of potential breach
   - Recommend changing passwords (if applicable)

## 📚 Additional Resources

- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/security)
- [Plaid Security Guide](https://plaid.com/docs/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

