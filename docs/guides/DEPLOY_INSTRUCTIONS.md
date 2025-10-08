# 🚀 SUPABASE DEPLOYMENT - FÆRDIG TIL KØRSEL

## ⚡ HURTIG DEPLOYMENT (ANBEFALET)

### 📍 **Metode 1: Supabase Dashboard SQL Editor** (Nemmest)

1. **Gå til**: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu
2. **Login** med din Supabase konto
3. **Klik på**: "SQL Editor" i venstre sidebar
4. **Klik på**: "New query" knappen
5. **Åbn filen**: `deploy-create-game-migration.sql`
6. **Kopier alt indhold** og indsæt i SQL Editor
7. **Klik "Run"** eller tryk Ctrl+Enter

**✅ Forventet resultat**: "Enhanced create_game function deployed successfully"

---

### 📍 **Metode 2: Direct PostgreSQL** (Avanceret)

**Krav database password:**
1. Gå til: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu/settings/database
2. Kopier database password
3. Opdater `direct-psql-deploy.js` med password
4. Kør: `node direct-psql-deploy.js`

---

## 🎯 **HVAD BLIVER DEPLOYED**

### Enhanced `create_game` Function:
```sql
-- NYE FUNKTIONER:
CREATE OR REPLACE FUNCTION public.create_game(
  p_league_id uuid,
  p_name text,
  p_duration_days integer DEFAULT NULL  -- ← NY PARAMETER!
)
```

### Plan-Based Validation:
- **FREE plan**: Tvinger `duration_days = 14` (ignorer klient input)
- **PRO plan**: Validerer `14 ≤ duration_days ≤ 30`, default 14
- **Server-side sikkerhed**: `SECURITY DEFINER` + låst `search_path`

### Backward Compatibility:
```sql
-- EKSISTERENDE KALD VIRKER STADIG:
SELECT create_game('league-id', 'Game Name');

-- NYE KALD MED DURATION:
SELECT create_game('league-id', 'Game Name', 21);
```

---

## 🔍 **VERIFIKATION EFTER DEPLOYMENT**

### Test i SQL Editor:
```sql
-- Check functions exist
SELECT
  routine_name,
  specific_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'create_game'
AND routine_schema = 'public'
ORDER BY specific_name;

-- Should return 2 rows (both overloaded versions)
```

### Test Function Call:
```sql
-- Test with PRO plan validation (should fail)
SELECT create_game(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'Test Game',
  35  -- Invalid: > 30 days
);

-- Expected: {"success": false, "error": "For Pro plans, duration_days must be between 14 and 30 days"}
```

---

## 🎉 **EFTER DEPLOYMENT**

### Frontend Changes Går Live:
✅ **FREE plan UI**: Fast "14 dage (Gratis)" display
✅ **PRO plan UI**: 14-30 dage dropdown selector
✅ **Start Game CTA**: Synlig for alle league medlemmer
✅ **Server validering**: Fuld plan enforcement

### Production URLs:
- **Frontend**: https://d6e7fac7.runaro.pages.dev
- **Database**: Deployed via din Supabase dashboard
- **Live Site**: https://runaro.dk

---

## 🚨 **HVIS NOGET FEJLER**

### Dashboard Fejl:
- Check for syntax errors i SQL
- Ensure du er logget ind som admin
- Prøv at køre statements individuelt

### Function Ikke Fundet:
- Verifier med `SELECT * FROM information_schema.routines WHERE routine_name = 'create_game'`
- Check RLS policies med `SELECT * FROM information_schema.table_privileges`

### Permissions Fejl:
- Ensure service role har EXECUTE privilegier
- Check `GRANT EXECUTE ON FUNCTION public.create_game TO authenticated`

---

## 🎯 **READY TO DEPLOY!**

Alt kode er klar. Vælg din deployment metode og kør!

**Metode 1** (Dashboard) er hurtigst og sikreste. 🚀