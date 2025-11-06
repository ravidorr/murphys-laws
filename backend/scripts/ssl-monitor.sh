#!/bin/bash

#############################################################################
# SSL Certificate Monitoring Script
# Checks certificate expiration, validates certificate chain, and verifies renewal
# Sends alerts at 30, 14, and 7 days before expiration
#############################################################################

DOMAIN="murphys-laws.com"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/cert.pem"
CHAIN_PATH="/etc/letsencrypt/live/$DOMAIN/chain.pem"
FULLCHAIN_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
ALERT_EMAIL="ravidor@gmail.com"
LOG_FILE="/var/log/ssl-monitor.log"
ALERT_STATE_DIR="/var/tmp/ssl-alerts"

# Create alert state directory
mkdir -p "$ALERT_STATE_DIR"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if alert was already sent for this day
should_send_alert() {
    local alert_type="$1"
    local state_file="$ALERT_STATE_DIR/${alert_type}-$(date +%Y-%m-%d)"

    if [ -f "$state_file" ]; then
        return 1  # Don't send alert (already sent today)
    fi

    # Create state file
    touch "$state_file"

    # Clean up old state files (older than 7 days)
    find "$ALERT_STATE_DIR" -name "${alert_type}-*" -mtime +7 -delete

    return 0  # Send alert
}

# Send email alert
send_alert() {
    local subject="$1"
    local body="$2"
    local alert_type="$3"

    if should_send_alert "$alert_type"; then
        echo "$body" | mail -s "[Murphy's Laws] $subject" "$ALERT_EMAIL"
        log "ALERT SENT: $subject"
    else
        log "ALERT SUPPRESSED (already sent today): $subject"
    fi
}

log "=========================================="
log "SSL Certificate Monitoring"
log "=========================================="
log "Domain: $DOMAIN"

# Check if certificate exists
if [ ! -f "$CERT_PATH" ]; then
    log "Certificate file not found: $CERT_PATH"
    send_alert \
        "SSL Certificate Missing" \
        "The SSL certificate file for $DOMAIN was not found at $CERT_PATH.

This is a critical issue that requires immediate attention.

Time: $(date)" \
        "cert_missing"
    exit 1
fi

# 1. Check certificate expiration
log "Checking certificate expiration..."

EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$CERT_PATH" | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s 2>/dev/null)
CURRENT_EPOCH=$(date +%s)
DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))

log "Certificate expires: $EXPIRY_DATE"
log "Days until expiry: $DAYS_UNTIL_EXPIRY"

# Send alerts at different thresholds
if [ "$DAYS_UNTIL_EXPIRY" -lt 7 ]; then
    log "CRITICAL: Certificate expires in $DAYS_UNTIL_EXPIRY days!"
    send_alert \
        "CRITICAL: SSL Certificate Expires in $DAYS_UNTIL_EXPIRY Days!" \
        "Your SSL certificate for $DOMAIN is about to expire!

Expiration Date: $EXPIRY_DATE
Days Remaining: $DAYS_UNTIL_EXPIRY

ACTION REQUIRED: The certificate must be renewed immediately to avoid service disruption.

To renew manually:
  sudo certbot renew

Time: $(date)" \
        "expiry_7days"
elif [ "$DAYS_UNTIL_EXPIRY" -lt 14 ]; then
    log "WARNING: Certificate expires in $DAYS_UNTIL_EXPIRY days"
    send_alert \
        "WARNING: SSL Certificate Expires in $DAYS_UNTIL_EXPIRY Days" \
        "Your SSL certificate for $DOMAIN will expire soon.

Expiration Date: $EXPIRY_DATE
Days Remaining: $DAYS_UNTIL_EXPIRY

Certbot should automatically renew the certificate, but please verify that auto-renewal is working.

To check renewal:
  sudo certbot renew --dry-run

Time: $(date)" \
        "expiry_14days"
elif [ "$DAYS_UNTIL_EXPIRY" -lt 30 ]; then
    log "INFO: Certificate expires in $DAYS_UNTIL_EXPIRY days"
    send_alert \
        "INFO: SSL Certificate Expires in $DAYS_UNTIL_EXPIRY Days" \
        "Your SSL certificate for $DOMAIN will expire in about a month.

Expiration Date: $EXPIRY_DATE
Days Remaining: $DAYS_UNTIL_EXPIRY

This is a reminder to ensure auto-renewal is configured and working properly.

Time: $(date)" \
        "expiry_30days"
else
    log "Certificate is valid for $DAYS_UNTIL_EXPIRY days"
fi

# 2. Verify certificate chain
log "Verifying certificate chain..."

if [ -f "$CHAIN_PATH" ] && [ -f "$FULLCHAIN_PATH" ]; then
    # Verify the chain
    if openssl verify -CAfile "$CHAIN_PATH" "$CERT_PATH" > /dev/null 2>&1; then
        log "Certificate chain is valid"
    else
        log "Certificate chain validation failed"
        send_alert \
            "SSL Certificate Chain Invalid" \
            "The SSL certificate chain for $DOMAIN failed validation.

This may cause trust issues for some browsers and clients.

Certificate: $CERT_PATH
Chain: $CHAIN_PATH

Please investigate and reinstall the certificate if necessary.

Time: $(date)" \
            "chain_invalid"
    fi

    # Check that fullchain contains both cert and chain
    CERT_COUNT=$(grep -c "BEGIN CERTIFICATE" "$FULLCHAIN_PATH")
    if [ "$CERT_COUNT" -ge 2 ]; then
        log "Full chain contains $CERT_COUNT certificates"
    else
        log "Full chain only contains $CERT_COUNT certificate(s), expected at least 2"
    fi
else
    log "Chain files not found, skipping chain validation"
fi

# 3. Check certificate details
log "Checking certificate details..."

# Get subject
SUBJECT=$(openssl x509 -subject -noout -in "$CERT_PATH" | cut -d= -f2-)
log "Subject: $SUBJECT"

# Get issuer
ISSUER=$(openssl x509 -issuer -noout -in "$CERT_PATH" | cut -d= -f2-)
log "Issuer: $ISSUER"

# Get SANs (Subject Alternative Names)
SANS=$(openssl x509 -text -noout -in "$CERT_PATH" | grep -A1 "Subject Alternative Name" | tail -1 | tr ',' '\n' | grep "DNS:" | sed 's/DNS://g' | xargs)
log "SANs: $SANS"

# Verify domain is in SANs
if echo "$SANS" | grep -q "$DOMAIN"; then
    log "Domain $DOMAIN found in SANs"
else
    log "Domain $DOMAIN NOT found in SANs"
    send_alert \
        "SSL Certificate Domain Mismatch" \
        "The SSL certificate for $DOMAIN does not include the domain in its Subject Alternative Names.

Domain: $DOMAIN
SANs: $SANS

This will cause SSL errors for visitors.

Time: $(date)" \
        "domain_mismatch"
fi

# 4. Check auto-renewal configuration
log "Checking auto-renewal configuration..."

if systemctl is-enabled certbot.timer >/dev/null 2>&1; then
    log "Certbot timer is enabled"

    # Check when it last ran
    LAST_RUN=$(systemctl status certbot.timer | grep "Trigger:" | awk '{print $2, $3, $4}')
    log "Next scheduled renewal: $LAST_RUN"
else
    log "Certbot timer is NOT enabled"
    send_alert \
        "SSL Auto-Renewal Not Configured" \
        "The certbot automatic renewal timer is not enabled on $DOMAIN.

Certificates will not be automatically renewed, which may lead to service disruption.

To enable auto-renewal:
  sudo systemctl enable certbot.timer
  sudo systemctl start certbot.timer

Time: $(date)" \
        "renewal_disabled"
fi

# Test renewal (dry-run)
log "Testing certificate renewal (dry-run)..."
if certbot renew --dry-run > /tmp/certbot-dry-run.log 2>&1; then
    log "Renewal dry-run successful"
else
    log "Renewal dry-run failed"
    DRY_RUN_OUTPUT=$(cat /tmp/certbot-dry-run.log)

    send_alert \
        "SSL Renewal Test Failed" \
        "The certbot renewal dry-run test failed for $DOMAIN.

This indicates that automatic renewal may fail when the certificate expires.

Error output:
$DRY_RUN_OUTPUT

Please investigate and fix the renewal configuration.

Time: $(date)" \
        "renewal_test_failed"
fi

# 5. Check certificate file permissions
log "Checking certificate file permissions..."

for file in "$CERT_PATH" "$CHAIN_PATH" "$FULLCHAIN_PATH"; do
    if [ -f "$file" ]; then
        PERMS=$(stat -c %a "$file" 2>/dev/null || stat -f %Lp "$file" 2>/dev/null)
        OWNER=$(stat -c %U "$file" 2>/dev/null || stat -f %Su "$file" 2>/dev/null)
        log "  $file: $PERMS ($OWNER)"

        # Check if permissions are too permissive
        if [ "${PERMS:1:1}" -gt 4 ] || [ "${PERMS:2:1}" -gt 4 ]; then
            log "  Permissions may be too permissive"
        fi
    fi
done

log "=========================================="
log "SSL monitoring completed"
log "=========================================="
