## Claude Code Database Setup

This document explains how to set up automatic database management for Claude Code.

### Step 1: Create the DDL Executor Function

Run this SQL once in Supabase SQL Editor (https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu/sql/new):

\
### Step 2: Environment Variables Setup

The .env.example file contains all necessary keys. In future chats, Claude will automatically read these.

### Step 3: Usage

- Run \ to create league functions
- Use \ function for any future database changes
- All credentials are stored in environment variables

### Available Scripts

- \ - Automatic DDL execution system
- \ - One-time setup SQL
- Run \ to fix league database issues

### For Claude Code Users

In future chats, simply mention "setup database" and Claude will:
1. Read credentials from .env.example
2. Execute necessary DDL using the claude_execute_ddl function
3. Fix any database issues automatically

No need to provide keys again\!
