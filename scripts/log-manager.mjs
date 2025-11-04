#!/usr/bin/env node
/**
 * Log Manager Utility
 * 
 * Provides utilities for managing application logs in the logs/ directory
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOGS_DIR = join(__dirname, '..', 'logs');

// Ensure logs directory exists
async function ensureLogsDir() {
  try {
    await mkdir(LOGS_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

// Get log file path
function getLogPath(service) {
  return join(LOGS_DIR, `${service}.log`);
}

// Get PID file path
function getPidPath(service) {
  return join(LOGS_DIR, `${service}.pid`);
}

// Write to log file with timestamp
export async function writeLog(service, message) {
  await ensureLogsDir();
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  const logPath = getLogPath(service);
  
  try {
    await writeFile(logPath, logEntry, { flag: 'a' });
  } catch (error) {
    console.error(`Failed to write to log file ${logPath}:`, error.message);
  }
}

// Read log file
export async function readLog(service, lines = 50) {
  const logPath = getLogPath(service);
  try {
    const content = await readFile(logPath, 'utf8');
    const logLines = content.split('\n').filter(line => line.trim());
    return logLines.slice(-lines).join('\n');
  } catch {
    return `Log file not found or empty: ${service}.log`;
  }
}

// Save process ID
export async function savePid(service, pid) {
  await ensureLogsDir();
  const pidPath = getPidPath(service);
  await writeFile(pidPath, pid.toString());
}

// Get process ID
export async function getPid(service) {
  const pidPath = getPidPath(service);
  try {
    const content = await readFile(pidPath, 'utf8');
    return parseInt(content.trim(), 10);
  } catch {
    return null;
  }
}

// List all log files
export async function listLogs() {
  await ensureLogsDir();
  try {
    const files = await readdir(LOGS_DIR);
    const logFiles = files.filter(file => file.endsWith('.log'));
    
    const logInfo = await Promise.all(
      logFiles.map(async (file) => {
        const service = file.replace('.log', '');
        const logPath = join(LOGS_DIR, file);
        const stats = await stat(logPath);
        return {
          service,
          size: stats.size,
          modified: stats.mtime,
          path: logPath
        };
      })
    );
    
    return logInfo.sort((a, b) => b.modified - a.modified);
  } catch {
    return [];
  }
}

// Clear log file
export async function clearLog(service) {
  const logPath = getLogPath(service);
  await writeFile(logPath, '');
  console.log(`Cleared log file: ${service}.log`);
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const service = process.argv[3];
  
  switch (command) {
    case 'list': {
      const logs = await listLogs();
      console.log('\nAvailable Log Files:\n');
      logs.forEach(log => {
        const sizeKB = (log.size / 1024).toFixed(1);
        const modified = log.modified.toLocaleString();
        console.log(`  ${log.service.padEnd(15)} ${sizeKB.padStart(6)}KB  ${modified}`);
      });
      break;
    }
      
    case 'read': {
      if (!service) {
        console.error('Usage: node log-manager.mjs read <service>');
        process.exit(1);
      }
      const content = await readLog(service);
      console.log(`\n${service}.log (last 50 lines):\n`);
      console.log(content);
      break;
    }
      
    case 'clear':
      if (!service) {
        console.error('Usage: node log-manager.mjs clear <service>');
        process.exit(1);
      }
      await clearLog(service);
      break;
      
    case 'pid': {
      if (!service) {
        console.error('Usage: node log-manager.mjs pid <service>');
        process.exit(1);
      }
      const pid = await getPid(service);
      if (pid) {
        console.log(`PID for ${service}: ${pid}`);
      } else {
        console.log(`No PID file found for ${service}`);
      }
      break;
    }
      
    default:
      console.log(`
Log Manager Utility

Usage:
  node scripts/log-manager.mjs <command> [service]

Commands:
  list                    List all log files with sizes and dates
  read <service>          Read the last 50 lines of a log file
  clear <service>         Clear a log file
  pid <service>           Get the process ID for a service

Examples:
  node scripts/log-manager.mjs list
  node scripts/log-manager.mjs read api-server
  node scripts/log-manager.mjs clear dev-server
  node scripts/log-manager.mjs pid api-server
      `);
  }
}
