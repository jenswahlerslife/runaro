# Supabase DDL Access Solutions

## 1. 🎯 **Supabase CLI med Project Link (Anbefalede)**

### Setup:
```bash
npx supabase login
npx supabase link --project-ref ojjpslrhyutizwpvvngu
npx supabase db pull  # Pull current schema
```

### Usage:
```bash
# Create migration file
npx supabase migration new add_included_in_game_column

# Run migration
npx supabase db push
```

### Fordele:
- ✅ Fuld DDL kontrol
- ✅ Migration tracking
- ✅ Version control
- ✅ Rollback muligheder

---

## 2. 🛠️ **Database URL Direct Connection**

### Setup PostgreSQL Tools:
```bash
npm install -g pg-cli
# eller
npm install pg
```

### Direct psql connection:
```bash
psql "postgresql://postgres:[PASSWORD]@db.ojjpslrhyutizwpvvngu.supabase.co:5432/postgres"
```

### Via Node.js:
```javascript
import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://postgres:[PASSWORD]@db.ojjpslrhyutizwpvvngu.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

await client.connect();
await client.query('ALTER TABLE public.user_activities ADD COLUMN included_in_game boolean DEFAULT true;');
await client.end();
```

---

## 3. 🔗 **HTTP API med Service Role**

### Create custom RPC function:
```sql
-- Run once in Supabase SQL Editor
CREATE OR REPLACE FUNCTION execute_ddl(sql_command text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_command;
END;
$$;
```

### Then use via API:
```javascript
const { data, error } = await supabase.rpc('execute_ddl', {
  sql_command: 'ALTER TABLE public.user_activities ADD COLUMN included_in_game boolean DEFAULT true'
});
```

---

## 4. 📝 **Migration Files System**

### Create migration system:
```javascript
// migrations/001_add_included_in_game.sql
ALTER TABLE public.user_activities 
  ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;

// migration_runner.js
import fs from 'fs';
import path from 'path';

async function runMigrations() {
  const migrationsDir = './migrations';
  const files = fs.readdirSync(migrationsDir).sort();
  
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Running ${file}...`);
    // Execute via chosen method above
  }
}
```

---

## 5. 🚀 **Webhook Trigger System**

### Setup webhook endpoint:
```javascript
// webhook_ddl.js - Deploy to Vercel/Netlify
export default async function handler(req, res) {
  const { sql, secret } = req.body;
  
  if (secret !== process.env.DDL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Execute DDL via direct connection
  const result = await executeSQL(sql);
  return res.json(result);
}
```

### Usage:
```javascript
async function executeDDL(sql) {
  const response = await fetch('https://your-webhook.vercel.app/api/ddl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      sql, 
      secret: process.env.DDL_SECRET 
    })
  });
  return response.json();
}
```

---

## 🏆 **Anbefalede Løsning: Supabase CLI**

Den nemmeste og sikreste måde:

1. **Initial setup** (kør én gang):
```bash
npm install -g supabase
npx supabase login
npx supabase link --project-ref ojjpslrhyutizwpvvngu
```

2. **For hver DDL ændring**:
```bash
npx supabase migration new descriptive_name
# Edit the generated .sql file
npx supabase db push
```

3. **Claude Code integration**:
```javascript
// claude_ddl.js
import { execSync } from 'child_process';
import fs from 'fs';

export function createMigration(name, sql) {
  const timestamp = Date.now();
  const filename = `${timestamp}_${name}.sql`;
  const filepath = `./supabase/migrations/${filename}`;
  
  fs.writeFileSync(filepath, sql);
  console.log(`Migration created: ${filepath}`);
  
  // Auto-apply if specified
  execSync('npx supabase db push', { stdio: 'inherit' });
  
  return filepath;
}
```

## 🎯 **Hvilken vil du have implementeret?**

Jeg anbefaler **Supabase CLI** løsningen - den giver fuld kontrol og er designet til formålet.