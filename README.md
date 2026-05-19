# <div align="center"><img src="resources/logo.png" alt="FakeDB Studio logo" width="69%" /></div>

## IT

FakeDB Studio è un'app desktop costruita con Electron, React e TypeScript che offre un'esperienza simile a MySQL Workbench, ma pensata per `FakeDB`.

`FakeDB` è un sistema di database basato su file JSON, progettato per lavorare in locale quando non si dispone di un driver per un database reale oppure quando serve simulare rapidamente una struttura dati persistente durante sviluppo, test o prototipazione.

Con FakeDB Studio puoi gestire il database locale tramite un'interfaccia grafica dedicata, con un approccio da "custom MySQL Workbench" per FakeDB.

### Cosa fa l'applicazione

- Permette di aprire e gestire un database FakeDB in locale.
- Fornisce un'interfaccia desktop per lavorare con dati salvati in JSON.
- Aiuta a simulare operazioni su database quando non è disponibile un driver specifico.
- Centralizza in un unico strumento la gestione del database locale per sviluppo e debugging.

### Requisiti

- Node.js 18 o superiore
- npm

### Avvio in sviluppo

1. Installa le dipendenze:

```bash
npm install
```

2. Avvia l'applicazione:

```bash
npm run dev
```

### Avvio su Windows

Apri PowerShell o il Prompt dei comandi nella cartella del progetto ed esegui:

```bash
npm install
npm run dev
```

Per generare una build Windows:

```bash
npm run build:win
```

### Avvio su Linux

Apri un terminale nella cartella del progetto ed esegui:

```bash
npm install
npm run dev
```

Per generare una build Linux:

```bash
npm run build:linux
```

### Avvio su macOS

Apri il Terminale nella cartella del progetto ed esegui:

```bash
npm install
npm run dev
```

Per generare una build macOS:

```bash
npm run build:mac
```

### Build multipiattaforma

Per eseguire la build standard del progetto:

```bash
npm run build
```

## EN

FakeDB Studio is a desktop application built with Electron, React, and TypeScript that provides a MySQL Workbench-like experience tailored for `FakeDB`.

`FakeDB` is a JSON-based database system designed to run locally when you do not have a driver for a real database, or when you need to quickly simulate a persistent data structure during development, testing, or prototyping.

With FakeDB Studio, you can manage a local FakeDB instance through a dedicated graphical interface, acting as a custom MySQL Workbench for FakeDB.

### What the application does

- Lets you open and manage a local FakeDB database.
- Provides a desktop UI for working with JSON-backed data.
- Helps simulate database operations when a specific database driver is not available.
- Centralizes local database management for development and debugging.

### Requirements

- Node.js 18 or later
- npm

### Run in development

1. Install dependencies:

```bash
npm install
```

2. Start the application:

```bash
npm run dev
```

### Run on Windows

Open PowerShell or Command Prompt in the project folder and run:

```bash
npm install
npm run dev
```

To generate a Windows build:

```bash
npm run build:win
```

### Run on Linux

Open a terminal in the project folder and run:

```bash
npm install
npm run dev
```

To generate a Linux build:

```bash
npm run build:linux
```

### Run on macOS

Open Terminal in the project folder and run:

```bash
npm install
npm run dev
```

To generate a macOS build:

```bash
npm run build:mac
```

### Cross-platform build

To run the standard project build:

```bash
npm run build
```
