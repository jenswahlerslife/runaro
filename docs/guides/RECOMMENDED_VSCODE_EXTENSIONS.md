# Recommended VS Code Extensions for Runaro Development

## Essential Extensions for React/TypeScript Development

### Core Language Support
1. **TypeScript Importer** (`pmneo.tsimporter`)
   - Auto-imports TypeScript modules
   - Saves time finding and importing components

2. **Auto Rename Tag** (`formulahendry.auto-rename-tag`)
   - Automatically renames paired HTML/JSX tags
   - Essential for React development

3. **Bracket Pair Colorizer 2** (Built into VS Code now)
   - Colors matching brackets
   - Helps with complex JSX nesting

### React-Specific
4. **ES7+ React/Redux/React-Native snippets** (`dsznajder.es7-react-js-snippets`)
   - Powerful React snippets (rafce, useState, useEffect, etc.)
   - Speeds up component creation significantly

5. **React PropTypes Intellisense** (`OfHumanBondage.react-proptypes-intellisense`)
   - Autocomplete for PropTypes
   - Better type safety for React props

### Database & API
6. **Supabase** (`supabase.supabase-vscode`)
   - Official Supabase extension
   - Database schema viewing, SQL execution
   - Perfect for your project!

7. **Thunder Client** (`rangav.vscode-thunder-client`)
   - REST API testing directly in VS Code
   - Great for testing your Supabase API endpoints

### CSS/Styling
8. **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`)
   - Autocomplete for Tailwind classes
   - Class name validation and hover previews
   - Essential since you're using Tailwind

9. **CSS Modules** (`clinyong.vscode-css-modules`)
   - IntelliSense for CSS modules
   - Useful if you have any CSS modules

### Code Quality
10. **ESLint** (`dbaeumer.vscode-eslint`)
    - Linting for JavaScript/TypeScript
    - Catches errors and enforces code style

11. **Prettier - Code formatter** (`esbenp.prettier-vscode`)
    - Automatic code formatting
    - Keeps code consistent

12. **Error Lens** (`usernamehw.errorlens`)
    - Shows errors inline in the editor
    - Makes debugging much faster

### Git & Version Control
13. **GitLens** (`eamodio.gitlens`)
    - Enhanced Git capabilities
    - Blame annotations, commit history, etc.

14. **Git Graph** (`mhutchie.git-graph`)
    - Visual Git history
    - Better than command line for complex merges

### Development Workflow
15. **Live Server** (`ritwickdey.liveserver`)
    - Local development server
    - Auto-refresh on file changes

16. **Path Intellisense** (`christian-kohler.path-intellisense`)
    - Autocomplete for file paths
    - Reduces import errors

17. **Auto Import - ES6, TS, JSX, TSX** (`steoates.autoimport`)
    - Automatic imports for TypeScript/JavaScript
    - Saves time on imports

### Specific to Your Project
18. **Vite** (`antfu.vite`)
    - Vite integration
    - Since you're using Vite for your build

19. **React Hooks Snippets** (`antfu.react-hooks-snippets`)
    - Snippets for React hooks
    - Faster hook implementation

20. **PostCSS Language Support** (`csstools.postcss`)
    - If you're using PostCSS with Tailwind

## Claude Code Specific
21. **Claude Code** (if available in marketplace)
    - Direct integration with Claude
    - Better AI assistance

## Quick Install Commands

You can install multiple extensions at once using VS Code's command palette:

```bash
# Core essentials (run in VS Code terminal)
code --install-extension pmneo.tsimporter
code --install-extension formulahendry.auto-rename-tag
code --install-extension dsznajder.es7-react-js-snippets
code --install-extension bradlc.vscode-tailwindcss
code --install-extension supabase.supabase-vscode
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension usernamehw.errorlens
code --install-extension eamodio.gitlens
code --install-extension rangav.vscode-thunder-client
```

## Priority Installation Order

**Must-have (Install first):**
1. TypeScript Importer
2. ES7+ React snippets  
3. Tailwind CSS IntelliSense
4. Supabase extension
5. ESLint
6. Prettier

**Highly Recommended:**
7. Error Lens
8. GitLens
9. Thunder Client
10. Auto Rename Tag

**Nice to have:**
- Rest of the list based on your preferences

These extensions will make development much smoother and help me assist you better by having better code analysis and formatting tools available!