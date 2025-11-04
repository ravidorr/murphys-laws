#!/bin/bash

#############################################################################
# Cost Optimization Report
# Analyzes resource utilization and provides cost-saving recommendations
# Run monthly to identify optimization opportunities
#############################################################################

REPORT_FILE="/tmp/cost-optimization-report-$(date +%Y-%m).txt"
ALERT_EMAIL="ravidor@gmail.com"

# Generate report
REPORT=""

REPORT+="COST OPTIMIZATION REPORT\n"
REPORT+="Murphy's Laws Infrastructure\n"
REPORT+="Generated: $(date '+%Y-%m-%d %H:%M:%S')\n"
REPORT+="========================\n\n"

# 1. Current Infrastructure Costs
REPORT+="1. CURRENT INFRASTRUCTURE COSTS\n"
REPORT+="================================\n\n"

REPORT+="DigitalOcean Droplets:\n"
REPORT+="  • Main Application Droplet (167.99.53.90)\n"
REPORT+="    - Size: 1GB RAM, 1 vCPU, 25GB SSD\n"
REPORT+="    - Estimated Cost: \$6/month\n\n"

REPORT+="  • n8n Automation Droplet (45.55.74.28)\n"
REPORT+="    - Size: 1GB RAM, 1 vCPU, 25GB SSD\n"
REPORT+="    - Estimated Cost: \$6/month\n\n"

REPORT+="Third-Party Services:\n"
REPORT+="  • Domain (murphys-laws.com): \$12/year (\$1/month)\n"
REPORT+="  • ImprovMX (Email Forwarding): Free\n"
REPORT+="  • smtp2go (Outbound Email): Free tier (1,000 emails/month)\n"
REPORT+="  • Google Analytics: Free\n"
REPORT+="  • Google AdSense: Revenue generating\n"
REPORT+="  • Let's Encrypt SSL: Free\n\n"

REPORT+="TOTAL MONTHLY COST: ~\$13/month (\$156/year)\n\n"

# 2. Resource Utilization Analysis
REPORT+="2. RESOURCE UTILIZATION ANALYSIS\n"
REPORT+="=================================\n\n"

# Main Droplet Analysis
REPORT+="Main Application Droplet:\n"
REPORT+="-------------------------\n"

# Memory usage
MEMORY_STATS=$(free -m | grep "Mem:")
MEMORY_TOTAL=$(echo "$MEMORY_STATS" | awk '{print $2}')
MEMORY_USED=$(echo "$MEMORY_STATS" | awk '{print $3}')
MEMORY_PERCENT=$(echo "scale=1; ($MEMORY_USED / $MEMORY_TOTAL) * 100" | bc)

REPORT+="Memory Usage:\n"
REPORT+="  Total: ${MEMORY_TOTAL}MB\n"
REPORT+="  Used: ${MEMORY_USED}MB (${MEMORY_PERCENT}%)\n"

if [ "${MEMORY_PERCENT%.*}" -lt 60 ]; then
    REPORT+="  Status: UNDER-UTILIZED - Consider downsizing\n"
elif [ "${MEMORY_PERCENT%.*}" -lt 80 ]; then
    REPORT+="  Status: Well optimized\n"
else
    REPORT+="  Status: HIGH - Consider upgrading\n"
fi
REPORT+="\n"

# CPU usage
CPU_COUNT=$(nproc)
LOAD_1M=$(uptime | awk -F'load average:' '{print $2}' | awk -F',' '{print $1}' | xargs)
LOAD_5M=$(uptime | awk -F'load average:' '{print $2}' | awk -F',' '{print $2}' | xargs)
LOAD_15M=$(uptime | awk -F'load average:' '{print $2}' | awk -F',' '{print $3}' | xargs)
CPU_PERCENT=$(echo "scale=0; ($LOAD_1M / $CPU_COUNT) * 100" | bc)

REPORT+="CPU Usage:\n"
REPORT+="  Cores: $CPU_COUNT\n"
REPORT+="  Load: ${LOAD_1M} (1m), ${LOAD_5M} (5m), ${LOAD_15M} (15m)\n"
REPORT+="  Utilization: ${CPU_PERCENT}%\n"

if [ "${CPU_PERCENT}" -lt 30 ]; then
    REPORT+="  Status: UNDER-UTILIZED\n"
elif [ "${CPU_PERCENT}" -lt 70 ]; then
    REPORT+="  Status: Well optimized\n"
else
    REPORT+="  Status: HIGH - Consider upgrading\n"
fi
REPORT+="\n"

# Disk usage
DISK_STATS=$(df -BG /root | tail -1)
DISK_TOTAL=$(echo "$DISK_STATS" | awk '{print $2}' | tr -d 'G')
DISK_USED=$(echo "$DISK_STATS" | awk '{print $3}' | tr -d 'G')
DISK_PERCENT=$(echo "$DISK_STATS" | awk '{print $5}' | tr -d '%')

REPORT+="Disk Usage:\n"
REPORT+="  Total: ${DISK_TOTAL}GB\n"
REPORT+="  Used: ${DISK_USED}GB (${DISK_PERCENT}%)\n"

if [ "$DISK_PERCENT" -lt 50 ]; then
    REPORT+="  Status: Plenty of space\n"
elif [ "$DISK_PERCENT" -lt 80 ]; then
    REPORT+="  Status: Adequate space\n"
else
    REPORT+="  Status: Running low - Consider cleanup or upgrade\n"
fi
REPORT+="\n"

# Disk space breakdown
REPORT+="Disk Space Breakdown:\n"
REPORT+="$(du -sh /root/murphys-laws 2>/dev/null | awk '{print "  Application: " $1}')\n"
REPORT+="$(du -sh /root/backups 2>/dev/null | awk '{print "  Backups: " $1}')\n"
REPORT+="$(du -sh /var/log 2>/dev/null | awk '{print "  Logs: " $1}')\n"
REPORT+="$(du -sh /var/lib/docker 2>/dev/null | awk '{print "  Docker: " $1}' || echo "  Docker: N/A")\n"
REPORT+="\n"

# 3. Traffic Analysis
REPORT+="3. TRAFFIC ANALYSIS (Last 30 Days)\n"
REPORT+="===================================\n\n"

if [ -f /var/log/nginx/access.log ]; then
    # Approximate monthly requests (last 30 days worth of logs)
    TOTAL_REQUESTS=$(wc -l < /var/log/nginx/access.log)
    AVG_DAILY_REQUESTS=$((TOTAL_REQUESTS / 30))

    REPORT+="Total Requests (approx): $TOTAL_REQUESTS\n"
    REPORT+="Average Daily Requests: $AVG_DAILY_REQUESTS\n"

    # Estimate bandwidth
    TOTAL_BYTES=$(awk '{sum += $10} END {print sum}' /var/log/nginx/access.log)
    TOTAL_GB=$(echo "scale=2; $TOTAL_BYTES / 1024 / 1024 / 1024" | bc)

    REPORT+="Total Bandwidth: ${TOTAL_GB}GB\n\n"

    # DigitalOcean includes 1TB transfer, check if we're exceeding
    if [ "$(echo "$TOTAL_GB < 1000" | bc)" -eq 1 ]; then
        REPORT+="Well within 1TB transfer limit\n"
    else
        REPORT+="Approaching/exceeding 1TB limit (may incur overage charges)\n"
    fi
    REPORT+="\n"
else
    REPORT+="No traffic data available\n\n"
fi

# 4. Cost Optimization Recommendations
REPORT+="4. COST OPTIMIZATION RECOMMENDATIONS\n"
REPORT+="====================================\n\n"

SAVINGS_TOTAL=0

# Recommendation 1: Droplet Sizing
if [ "${MEMORY_PERCENT%.*}" -lt 50 ] && [ "${CPU_PERCENT}" -lt 30 ]; then
    REPORT+="RECOMMENDATION #1: Consider Downsizing Droplets\n"
    REPORT+="  Current: 1GB RAM droplets at \$6/month each\n"
    REPORT+="  Suggested: 512MB RAM droplets at \$4/month each\n"
    REPORT+="  Savings: \$4/month (\$48/year)\n"
    REPORT+="  Pros: Lower cost, similar performance\n"
    REPORT+="  Cons: Less headroom for traffic spikes\n"
    REPORT+="  Action: Monitor peak usage for 1 month before deciding\n\n"
    SAVINGS_TOTAL=$((SAVINGS_TOTAL + 4))
else
    REPORT+="Droplet sizing appears appropriate\n\n"
fi

# Recommendation 2: Combine Droplets
REPORT+="RECOMMENDATION #2: Consolidate Droplets\n"
REPORT+="  Current: 2 separate droplets (\$12/month)\n"
REPORT+="  Suggested: Run n8n on main droplet\n"
REPORT+="  Savings: \$6/month (\$72/year)\n"
REPORT+="  Pros: Significant cost savings\n"
REPORT+="  Cons: Single point of failure, less isolation\n"
REPORT+="  Action: Test n8n + app on 1GB droplet in staging\n\n"
SAVINGS_TOTAL=$((SAVINGS_TOTAL + 6))

# Recommendation 3: Optimize Backups
if [ -d /root/backups ]; then
    BACKUP_SIZE=$(du -sh /root/backups | awk '{print $1}')
    REPORT+="RECOMMENDATION #3: Optimize Backup Storage\n"
    REPORT+="  Current backup size: $BACKUP_SIZE\n"
    REPORT+="  • Compress older backups (>7 days)\n"
    REPORT+="  • Reduce retention from 30 to 14 days\n"
    REPORT+="  • Consider off-site backup to DigitalOcean Spaces\n"
    REPORT+="  Potential Savings: Minimal, but improves reliability\n\n"
fi

# Recommendation 4: Free Service Alternatives
REPORT+="RECOMMENDATION #4: Service Optimization\n"
REPORT+="  Current setup already uses free tiers effectively:\n"
REPORT+="  Let's Encrypt SSL (free)\n"
REPORT+="  smtp2go free tier (1,000 emails/month)\n"
REPORT+="  ImprovMX email forwarding (free)\n"
REPORT+="  Google Analytics (free)\n\n"

REPORT+="  Monitor email usage:\n"
if [ -f /var/log/mail.log ]; then
    MONTHLY_EMAILS=$(grep "status=sent" /var/log/mail.log 2>/dev/null | wc -l)
    REPORT+="  • Current: ~$MONTHLY_EMAILS emails/month\n"
    REPORT+="  • smtp2go limit: 1,000/month\n"
    if [ "$MONTHLY_EMAILS" -gt 800 ]; then
        REPORT+="  Approaching smtp2go limit\n"
    else
        REPORT+="  Well within limits\n"
    fi
else
    REPORT+="  • Email logs not available\n"
fi
REPORT+="\n"

# Recommendation 5: Performance Optimizations
REPORT+="RECOMMENDATION #5: Performance Optimizations\n"
REPORT+="  These don't reduce cost but improve resource efficiency:\n"
REPORT+="  • Enable nginx caching for static assets\n"
REPORT+="  • Implement CDN (Cloudflare free tier)\n"
REPORT+="  • Optimize database queries\n"
REPORT+="  • Review PM2 memory usage\n\n"

# Recommendation 6: Revenue Optimization
REPORT+="RECOMMENDATION #6: Revenue Optimization\n"
REPORT+="  Google AdSense is configured. To maximize revenue:\n"
REPORT+="  • Review ad placement for better visibility\n"
REPORT+="  • Analyze which pages get most traffic\n"
REPORT+="  • Optimize content for SEO\n"
REPORT+="  • Monitor AdSense reports monthly\n"
REPORT+="  Goal: Offset infrastructure costs with ad revenue\n\n"

# 5. Long-term Cost Projections
REPORT+="5. LONG-TERM COST PROJECTIONS\n"
REPORT+="==============================\n\n"

REPORT+="Current Annual Cost: \$156\n"
REPORT+="  • DigitalOcean: \$144/year\n"
REPORT+="  • Domain: \$12/year\n\n"

REPORT+="Projected Cost if Optimizations Implemented:\n"
REPORT+="  • Consolidate droplets: -\$72/year\n"
REPORT+="  • Optimized sizing: -\$48/year (if applicable)\n"
REPORT+="  • New Annual Cost: \$36-\$84/year\n\n"

REPORT+="Potential Total Savings: \$${SAVINGS_TOTAL}/month (\$$(($SAVINGS_TOTAL * 12))/year)\n\n"

# 6. Action Items Summary
REPORT+="6. ACTION ITEMS SUMMARY\n"
REPORT+="=======================\n\n"

REPORT+="Immediate Actions:\n"
REPORT+="  [ ] Review AdSense earnings vs costs\n"
REPORT+="  [ ] Monitor peak resource usage for 30 days\n"
REPORT+="  [ ] Implement nginx caching\n"
REPORT+="  [ ] Set up email usage monitoring\n\n"

REPORT+="Short-term (1-3 months):\n"
REPORT+="  [ ] Test running n8n on main droplet\n"
REPORT+="  [ ] Evaluate CDN implementation\n"
REPORT+="  [ ] Optimize database performance\n"
REPORT+="  [ ] Review backup retention policy\n\n"

REPORT+="Long-term (3-6 months):\n"
REPORT+="  [ ] Consider DigitalOcean Spaces for backups\n"
REPORT+="  [ ] Implement droplet snapshots\n"
REPORT+="  [ ] Review traffic patterns for scaling needs\n"
REPORT+="  [ ] Evaluate alternative hosting if traffic grows significantly\n\n"

# 7. Resource Usage Trends
REPORT+="7. RESOURCE USAGE TRENDS\n"
REPORT+="========================\n\n"

if [ -f /var/log/performance-metrics/metrics-$(date +%Y-%m).csv ]; then
    REPORT+="Performance metrics available for trend analysis.\n"
    REPORT+="Review /var/log/performance-metrics/ for detailed data.\n\n"

    # Calculate average memory usage over the month
    AVG_MEMORY=$(awk -F',' 'NR>1 && $7 != "" {sum+=$7; count++} END {if (count>0) printf "%.1f", sum/count}' /var/log/performance-metrics/metrics-$(date +%Y-%m).csv)
    REPORT+="Average Memory Usage This Month: ${AVG_MEMORY}%\n"

    # Calculate average response times
    AVG_API_RESPONSE=$(awk -F',' 'NR>1 && $3 != "" {sum+=$3; count++} END {if (count>0) printf "%.0f", sum/count}' /var/log/performance-metrics/metrics-$(date +%Y-%m).csv)
    REPORT+="Average API Response Time: ${AVG_API_RESPONSE}ms\n\n"

    if [ "$(echo "$AVG_MEMORY < 60" | bc)" -eq 1 ]; then
        REPORT+="Trend: Consistent low memory usage suggests potential for downsizing\n"
    fi

    if [ -n "$AVG_API_RESPONSE" ] && [ "$AVG_API_RESPONSE" -lt 200 ]; then
        REPORT+="Trend: Fast response times indicate good performance\n"
    fi
    REPORT+="\n"
else
    REPORT+="No performance trend data available yet.\n"
    REPORT+="Metrics will be available after performance tracker is deployed.\n\n"
fi

# 8. Conclusion
REPORT+="8. CONCLUSION\n"
REPORT+="=============\n\n"

REPORT+="Current infrastructure is cost-effective and well-optimized.\n\n"

if [ "$SAVINGS_TOTAL" -gt 5 ]; then
    REPORT+="Potential savings of \$${SAVINGS_TOTAL}/month are available through\n"
    REPORT+="droplet consolidation and optimization.\n\n"
    REPORT+="Recommendation: Prioritize testing droplet consolidation\n"
    REPORT+="to reduce costs by 50% while maintaining performance.\n"
else
    REPORT+="Infrastructure is already highly optimized.\n"
    REPORT+="Focus on revenue optimization through AdSense.\n"
fi

REPORT+="\nNext Review: $(date -d '+1 month' +%Y-%m-%d)\n"

# Save report
echo -e "$REPORT" > "$REPORT_FILE"
echo "Cost optimization report saved to $REPORT_FILE"

# Email report
cat "$REPORT_FILE" | mail -s "[Murphy's Laws] Monthly Cost Optimization Report" "$ALERT_EMAIL"
echo "Report emailed to $ALERT_EMAIL"

# Display summary
echo -e "\n=== SUMMARY ==="
echo "Current Monthly Cost: \$13"
echo "Potential Savings: \$${SAVINGS_TOTAL}/month"
echo "Optimization Opportunity: $(echo "scale=0; ($SAVINGS_TOTAL / 13) * 100" | bc)%"
echo "Full report: $REPORT_FILE"
