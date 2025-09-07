// Script to configure Supabase Auth settings automatically
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNDY5MDY0NSwiZXhwIjoyMDQwMjY2NjQ1fQ.WJT3YGOtLd4r7FPEm9UfKBSy4UqZZSRmUCE4VzqQLyc";

console.log('🔧 Konfigurerer Supabase Auth indstillinger automatisk...\n');

console.log('📋 MANUAL OPSÆTNING KRÆVET');
console.log('==========================\n');

console.log('Da Supabase Auth indstillinger ikke kan ændres via API, skal du gøre følgende:\n');

console.log('1. 🌐 Gå til Supabase Dashboard:');
console.log('   https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu\n');

console.log('2. 🔗 Authentication → Settings → URL Configuration:');
console.log('   Site URL: https://runaro.dk');
console.log('   Additional Redirect URLs:');
console.log('   - https://runaro.dk/auth');
console.log('   - https://runaro.dk/auth/callback');
console.log('   - https://runaro.dk/\n');

console.log('3. 📧 Authentication → Providers → Email:');
console.log('   ✅ Slå "Confirm email" TIL');
console.log('   ✅ Slå "Double confirm email changes" TIL (valgfrit)');
console.log('   📤 Vælg email provider:\n');

console.log('   OPTION A - Supabase Built-in (Hurtigst):');
console.log('   - Vælg "Supabase" som provider');
console.log('   - Sender fra: no-reply@mail.supabase.io');
console.log('   - Fungerer med det samme\n');

console.log('   OPTION B - Custom SMTP (Anbefalet for produktion):');
console.log('   - Vælg "Custom SMTP"');
console.log('   - Host: smtp.gmail.com (for Gmail) eller smtp-mail.outlook.com (for Outlook)');
console.log('   - Port: 587');
console.log('   - Username: [din email]');
console.log('   - Password: [app password - ikke almindelig adgangskode]');
console.log('   - Sender name: Runaro');
console.log('   - Sender email: [din email eller no-reply@runaro.dk]\n');

console.log('4. 🎨 Authentication → Templates → Confirm Signup:');
console.log('   ✅ Bekræft at skabelonen er aktiv');
console.log('   🔗 Bekræft at "Confirm URL" indeholder {{ .ConfirmationURL }}');
console.log('   📝 Tilpas besked efter behov (valgfrit)\n');

console.log('5. 🧪 Test konfigurationen:');
console.log('   - Tryk "Send test email" i email provider indstillinger');
console.log('   - Hvis den virker: Prøv signup på https://runaro.dk/auth');
console.log('   - Tjek din email (også spam/junk folder)\n');

console.log('6. 📊 Logs → Authentication:');
console.log('   - Tjek for fejl efter signup-forsøg');
console.log('   - Look for "email sent" bekræftelser\n');

console.log('🎯 VIGTIGE KONTROLLER:');
console.log('=====================');
console.log('✅ Site URL er præcis: https://runaro.dk (ikke med trailing slash)');
console.log('✅ Email confirmation er slået TIL');
console.log('✅ Email provider er konfigureret og testet');
console.log('✅ Redirect URLs inkluderer https://runaro.dk/auth');
console.log('✅ Email skabelon bruger {{ .ConfirmationURL }}');

console.log('\n🚀 Efter konfiguration:');
console.log('======================');
console.log('1. Prøv signup på https://runaro.dk/auth');
console.log('2. Tjek din email (inkl. spam folder)');
console.log('3. Klik på bekræftelseslinket');
console.log('4. Du burde blive redirected til https://runaro.dk/auth');
console.log('5. Log ind med dine nye credentials\n');

console.log('📞 FEJLSØGNING:');
console.log('==============');
console.log('- Email ikke modtaget? Tjek Logs → Authentication for fejl');
console.log('- Link virker ikke? Tjek at Redirect URLs matcher');
console.log('- SMTP fejl? Tjek username/password og port indstillinger');
console.log('- Stadig problemer? Brug Supabase built-in email midlertidigt\n');

console.log('🏁 Konfiguration guide completed!');
console.log('Nu skal du manuelt opsætte indstillingerne i Supabase Dashboard.');

process.exit(0);