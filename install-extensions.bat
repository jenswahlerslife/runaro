@echo off
echo Installing VS Code Extensions for Runaro Development...
echo =====================================================

REM Core Language Support
echo Installing TypeScript Importer...
code --install-extension pmneo.tsimporter

echo Installing Auto Rename Tag...
code --install-extension formulahendry.auto-rename-tag

REM React Development
echo Installing React/Redux/React-Native snippets...
code --install-extension dsznajder.es7-react-js-snippets

echo Installing React PropTypes Intellisense...
code --install-extension OfHumanBondage.react-proptypes-intellisense

REM Database & API
echo Installing Supabase extension...
code --install-extension supabase.supabase-vscode

echo Installing Thunder Client (API testing)...
code --install-extension rangav.vscode-thunder-client

REM CSS/Styling
echo Installing Tailwind CSS IntelliSense...
code --install-extension bradlc.vscode-tailwindcss

echo Installing CSS Modules support...
code --install-extension clinyong.vscode-css-modules

REM Code Quality
echo Installing ESLint...
code --install-extension dbaeumer.vscode-eslint

echo Installing Prettier...
code --install-extension esbenp.prettier-vscode

echo Installing Error Lens...
code --install-extension usernamehw.errorlens

REM Git Tools
echo Installing GitLens...
code --install-extension eamodio.gitlens

echo Installing Git Graph...
code --install-extension mhutchie.git-graph

REM Development Workflow
echo Installing Live Server...
code --install-extension ritwickdey.liveserver

echo Installing Path Intellisense...
code --install-extension christian-kohler.path-intellisense

echo Installing Auto Import...
code --install-extension steoates.autoimport

REM Project Specific
echo Installing Vite support...
code --install-extension antfu.vite

echo Installing React Hooks Snippets...
code --install-extension antfu.react-hooks-snippets

echo Installing PostCSS Language Support...
code --install-extension csstools.postcss

REM Additional Helpful Extensions
echo Installing Indent Rainbow...
code --install-extension oderwat.indent-rainbow

echo Installing Bracket Pair Colorizer 2...
code --install-extension CoenraadS.bracket-pair-colorizer-2

echo Installing Material Icon Theme...
code --install-extension PKief.material-icon-theme

echo Installing One Dark Pro theme...
code --install-extension zhuangtongfa.Material-theme

REM Claude Code specific (if available)
echo Attempting to install Claude Code extension...
code --install-extension anthropic.claude-code 2>nul || echo Claude Code extension not available in marketplace

echo.
echo =====================================================
echo All extensions installed successfully!
echo Please restart VS Code to activate all extensions.
echo =====================================================
pause