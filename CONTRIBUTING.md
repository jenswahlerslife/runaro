# 🤝 Contributing til Runaro

Tak for din interesse i at bidrage til Runaro! Denne guide hjælper dig med at komme i gang.

## 🚀 Hurtig Start for Bidragydere

### 1. Development Environment Setup
```bash
# Fork og clone repository
git clone https://github.com/YOUR_USERNAME/runaro.git
cd runaro

# Kør automated setup
chmod +x scripts/dev-setup.sh
./scripts/dev-setup.sh

# Start development
npm run dev
```

### 2. Branch Strategi
```bash
# Opret feature branch
git checkout -b feature/din-feature-navn

# Eller bug fix branch
git checkout -b fix/din-bug-fix

# Eller hotfix (kun fra main)
git checkout -b hotfix/kritisk-fix
```

## 📋 Code Standards

### TypeScript & JavaScript
- **Strict TypeScript**: Alle nye filer skal bruge strict mode
- **No `any`**: Brug specifikke types eller `unknown`
- **Interface over Type**: Brug `interface` for objekttyper
- **Funktionel programmering**: Foretrækk immutable patterns

### React Komponenter
- **Functional Components**: Brug kun functional components med hooks
- **React.memo**: Memoise komponenter der re-renderer hyppigt
- **Custom Hooks**: Udskil kompleks logik til genbrug hooks
- **Lazy Loading**: Brug `React.lazy()` til store komponenter

### Database Design
- **RLS Policies**: Alle nye tabeller SKAL have Row Level Security
- **SECURITY DEFINER**: Alle functions SKAL bruge `SECURITY DEFINER` med låst `search_path`
- **Indexes**: Tilføj indexes til alle foreign keys og ofte-brugte felter
- **Migrations**: Skriv reversible migrationer med proper rollback

### CSS & Styling
- **Tailwind First**: Brug Tailwind utility classes
- **Component Variants**: Brug `cva` for komponent varianter
- **Mobile First**: Design mobile-first, derefter desktop
- **Dark Mode**: Alle nye komponenter skal supportere dark mode

## 🧪 Testing Requirements

### Obligatorisk Testing
Alle nye features skal have:
- **Unit tests**: Minimum 70% code coverage
- **Integration tests**: For API endpoints og database functions
- **Component tests**: For React komponenter med user interactions
- **E2E tests**: For kritiske user flows (betaling, auth, etc.)

### Test Commands
```bash
npm run test              # Kør alle tests
npm run test:watch        # Test i watch mode
npm run test:coverage     # Coverage rapport
npm run test:ui           # Visual test interface
```

### Test Patterns
```typescript
// ✅ Godt - Específic test med mocking
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/integrations/supabase/client');

test('should render league member count', () => {
  render(<LeagueMembersList members={mockMembers} />);
  expect(screen.getByText('5 medlemmer')).toBeInTheDocument();
});

// ❌ Dårligt - Generisk test uden assertions
test('component renders', () => {
  render(<SomeComponent />);
});
```

## 🔒 Sikkerhedsregel

### Kritiske Sikkerhedskrav
1. **Aldrig commit secrets**: Brug altid miljøvariabler
2. **RLS på alle tabeller**: Database security er obligatorisk
3. **Input validation**: Server-side validering på alle inputs
4. **HTTPS only**: Alle connections skal være encrypted
5. **CSP headers**: Content Security Policy på alle responses

### Security Checklist
- [ ] Hardcoded secrets fjernet
- [ ] RLS policies implementeret og testet
- [ ] Input sanitization på plads
- [ ] Error messages eksponerer ikke sensitive data
- [ ] Authentication og authorization er testet

## 📏 Code Review Process

### Pull Request Template
```markdown
## Beskrivelse
Kort beskrivelse af ændringerne

## Type ændring
- [ ] Bug fix (non-breaking change)
- [ ] Ny feature (non-breaking change)
- [ ] Breaking change (fix eller feature der bryder eksisterende funktionalitet)
- [ ] Dokumentation opdatering

## Testing
- [ ] Unit tests passed
- [ ] Integration tests passed
- [ ] Manual testing udført
- [ ] Performance impact vurderet

## Security
- [ ] Sikkerhedsmæssige implikationer vurderet
- [ ] Ingen hardcoded secrets
- [ ] RLS policies implementeret (hvis relevant)

## Screenshots (hvis relevant)
Tilføj screenshots af UI ændringer
```

### Review Checklist for Reviewers
- [ ] **Code Quality**: Følger projektets coding standards
- [ ] **Performance**: Ingen obvious performance problemer
- [ ] **Security**: Sikkerhedsbest practices fulgt
- [ ] **Tests**: Adequate test coverage
- [ ] **Documentation**: Kode er selvdokumenterende eller kommenteret

## 🐛 Bug Reports

### Bug Report Template
```markdown
**Beskrivelse**
Klar og koncis beskrivelse af bugget

**Gentagelse**
Steps til at genskabe:
1. Gå til '...'
2. Klik på '...'
3. Scroll ned til '...'
4. Se fejl

**Forventet adfærd**
Beskrivelse af hvad du forventede skulle ske

**Screenshots**
Hvis applicable, tilføj screenshots til at forklare problemet

**Environment:**
- OS: [e.g. iOS]
- Browser [e.g. chrome, safari]
- Version [e.g. 22]
```

## 💡 Feature Requests

### Feature Request Template
```markdown
**Er din feature request relateret til et problem?**
Klar beskrivelse af problemet. Ex. Jeg er altid frustreret når [...]

**Beskriv den løsning du vil have**
Klar og koncis beskrivelse af hvad du vil have der skal ske

**Beskriv alternativer du har overvejet**
Klar og koncis beskrivelse af alternative løsninger eller features

**Additional context**
Tilføj anden kontekst eller screenshots om feature request
```

## 🎯 Development Workflow

### 1. Før du starter
- Tjek eksisterende issues og PRs for at undgå duplikering
- Diskuter større features i issues før implementering
- Sørg for at dit development environment er opdateret

### 2. Under development
- Commit hyppigt med beskrivende commit messages
- Kør tests regelmæssigt (`npm run test:watch`)
- Test manuelt i browseren
- Verificer at alle pre-commit hooks passer

### 3. Før PR submission
- Kør full test suite: `npm run test:coverage`
- Verificer TypeScript: `npm run type-check`
- Kør linting: `npm run lint`
- Test production build: `npm run build`
- Opdater dokumentation hvis nødvendigt

### 4. Efter PR approval
- Squash commits hvis ønsket
- Delete feature branch efter merge

## 📞 Få Hjælp

- **GitHub Issues**: For bugs og feature requests
- **Discussions**: For spørgsmål og idéer
- **CLAUDE.md**: For projektspecifik dokumentation
- **README.md**: For setup og basis information

## 🏆 Recognition

Bidragydere anerkendes i:
- AUTHORS.md file
- Release notes for større bidrag
- Special mentions på sociale medier

Tak for at hjælpe med at gøre Runaro bedre! 🎉