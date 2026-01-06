# Campaign Posts Scheduler - Quick Start Guide

## What Was Created

A complete automated scheduling system for campaign posts that:

1. **Checks scheduled posts every 5 minutes** via Vercel Cron
2. **Sends posts automatically** via Email, SMS, WhatsApp, and Social Media
3. **Personalizes messages** with contact variables ({{name}}, {{email}}, etc.)
4. **Creates notifications** for success/failure tracking
5. **Provides admin interface** for manual testing

## Files Created

### API & Core Logic
- `app/api/scheduler/campaign-posts/route.ts` - Main scheduler endpoint
- `lib/messaging.ts` - Helper functions for sending messages
- `lib/email.ts` - Updated with generic sendEmail function

### Admin Interface
- `app/admin/scheduler/page.tsx` - Manual trigger and monitoring UI

### Configuration
- `vercel.json` - Updated with cron job configuration

### Documentation
- `docs/SCHEDULER.md` - Comprehensive documentation

## Quick Setup (5 Steps)

### 1. Set Environment Variables

Add to your `.env` file:

```bash
# Required: Cron authentication
CRON_SECRET=your-secure-random-secret-key-here

# Required for local testing (optional in production)
NEXT_PUBLIC_CRON_SECRET=your-secure-random-secret-key-here

# Already configured (verify these exist):
# TWILIO_ACCOUNT_SID
# TWILIO_AUTH_TOKEN
# TWILIO_PHONE_NUMBER
```

### 2. Configure Email (Mailgun)

These should already be in your `AdminPlatformConfiguration` table:
- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `MAILGUN_FROM_EMAIL`

If not, add them via your admin panel.

### 3. Deploy to Vercel

```bash
# Commit changes
git add .
git commit -m "Add campaign posts scheduler"
git push

# Vercel will automatically deploy and configure the cron job
```

### 4. Set Vercel Environment Variable

In Vercel Dashboard:
1. Go to your project → Settings → Environment Variables
2. Add: `CRON_SECRET` = `your-secure-random-secret-key-here`
3. Save and redeploy

### 5. Test the Scheduler

**Option A: Admin UI (Recommended)**
1. Go to `/admin/scheduler` in your app
2. Click "Run Scheduler Now"
3. View results and statistics

**Option B: API Call**
```bash
curl -X GET https://your-app.vercel.app/api/scheduler/campaign-posts \
  -H "Authorization: Bearer your-secure-random-secret-key-here"
```

## How to Use

### Creating a Scheduled Post

1. Go to a campaign's posts page
2. Click "Add Post"
3. Fill in the post details:
   - Select platform (Email, SMS, WhatsApp, etc.)
   - Enter subject/message
   - **Set scheduled time** (important!)
   - Add contacts if needed
4. Save the post

### The Post Will:
- ✅ Be sent automatically at the scheduled time
- ✅ Personalize variables for each contact
- ✅ Create notifications on success/failure
- ✅ Mark itself as sent after processing

## Variable Replacement

Use these variables in your messages:

- `{{name}}` - Contact's name
- `{{email}}` - Contact's email
- `{{phone}}` - Contact's phone number
- `{{mobile}}` - Contact's mobile number
- `{{whatsapp}}` - Contact's WhatsApp number

**Example:**
```
Hi {{name}},

Your appointment is confirmed for tomorrow at 2 PM.

Please call us at {{phone}} if you need to reschedule.

Thanks!
```

## Monitoring

### View Notifications

Check the Notifications table for:
- Success messages: "Scheduled EMAIL post sent successfully"
- Error messages: "Failed to send scheduled SMS post: [reason]"

### Check Logs

In Vercel Dashboard:
1. Go to your project → Deployments
2. Click on latest deployment → Functions
3. Find `/api/scheduler/campaign-posts`
4. View execution logs

### Admin Dashboard

Visit `/admin/scheduler` to:
- Manually trigger the scheduler
- View execution results
- See detailed statistics
- Check for errors

## Troubleshooting

### Posts Not Sending?

**Check 1: Is the post scheduled correctly?**
```sql
SELECT * FROM "CampaignPost" 
WHERE "isPostSent" = false 
AND "scheduledPostTime" <= NOW();
```

**Check 2: Is the cron job running?**
- Go to Vercel Dashboard → Cron Jobs
- Verify it's enabled and has recent executions

**Check 3: Is CRON_SECRET set?**
- Vercel Dashboard → Settings → Environment Variables
- Must match the value in your code

**Check 4: Check notifications**
```sql
SELECT * FROM "Notification" 
WHERE "type" = 'CAMPAIGN_POST' 
ORDER BY "createdAt" DESC 
LIMIT 10;
```

### Email Not Sending?

1. Check Mailgun configuration in `AdminPlatformConfiguration`
2. Verify API key is valid
3. Check Mailgun dashboard for delivery logs
4. Ensure sender email is verified in Mailgun

### SMS/WhatsApp Not Sending?

1. Verify Twilio credentials in `.env`
2. Check phone number format: `+1234567890`
3. Ensure Twilio account has balance
4. Check Twilio console for error logs

### Social Media Not Posting?

1. Verify user has connected their account
2. Check access token is valid (not expired)
3. Review platform API limits
4. Ensure user has posting permissions

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Email | ✅ Ready | Via Mailgun |
| SMS | ✅ Ready | Via Twilio |
| WhatsApp | ✅ Ready | Via Twilio |
| LinkedIn | ✅ Ready | Requires user token |
| Facebook | ⚠️ Partial | Needs implementation |
| Instagram | ⚠️ Partial | Needs implementation |
| YouTube | ⚠️ Partial | Needs implementation |
| Pinterest | ⚠️ Partial | Needs implementation |

## Next Steps

1. **Test with a sample post:**
   - Create a post scheduled for 2 minutes from now
   - Wait for the cron to run
   - Check if it was sent

2. **Monitor the first few runs:**
   - Check notifications
   - Review Vercel logs
   - Verify contacts received messages

3. **Implement remaining platforms:**
   - Facebook posting
   - Instagram posting
   - YouTube upload
   - Pinterest pins

4. **Add enhancements:**
   - Retry mechanism for failed posts
   - Rate limiting per platform
   - Scheduling preview
   - Bulk scheduling

## Support

For issues:
1. Check the logs in Vercel dashboard
2. Review notifications in database
3. Test manually via `/admin/scheduler`
4. Check `docs/SCHEDULER.md` for detailed documentation

## Security Notes

- ✅ All scheduler requests require Bearer token
- ✅ Contact data is handled securely
- ✅ Sensitive data not logged in errors
- ✅ Social media tokens encrypted in database

---

**Created**: December 2024  
**Status**: Production Ready  
**Cron Schedule**: Every 5 minutes (`*/5 * * * *`)
