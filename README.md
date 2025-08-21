# FTC Pitstop 🏎️

[https://ftcpitstop.com/](https://ftcpitstop.com/)

FTC Pitstop is a web application designed to help FIRST Tech Challenge teams analyze competition data and improve their strategy by providing a centralized display for their pit. It provides team comparison tools, match analysis, and ranking insights.

## Features 🌟

- Real-time team comparisons
- Detailed ranking analysis
- Match statistics visualization
- OPR/DPR calculations
- Historical performance tracking

## Running Locally 🚀

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- FTC API credentials

### Installation

1. Clone the repository

```bash
git clone https://github.com/nesetkab/ftc-pitstop.git
cd ftc-pitstop
```

2. Install dependencies

```bash
npm install
# or
yarn install
```

3. Duplicate `.env.local.example`, rename to `.env.local`. Fill in:

```
FTC_SEASON
FTC_API_KEY
FTC_USERNAME
KV_REST_API_URL
KV_REST_API_TOKEN
```

4. Start the development server

```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request. Found bugs? Feel free to open an issue.

## Contact 📧

- Join our [Discord](https://discord.gg/9Rdbdr2NAt)
- DM neset on Discord: @nerrdy_
- Project Link: [https://github.com/nesetkab/ftc-pitstop](https://github.com/nesetkab/ftc-pitstop)

---
Last Updated: 2025-06-18
