# COPOM — Uberlândia

Simulador de **Central de Operações (COPOM/COBOM)** com mapa de Uberlândia: despacho de viaturas, bases, ocorrências, rádio e painel de operações.

Stack: **React 19 + TypeScript + Vite + Leaflet**.

## Rodar local

```bash
npm install
npm run dev
```

Abra http://localhost:5173/

```bash
npm run build    # produção → pasta dist/
npm run preview  # pré-visualizar o build
```

## Deploy na Vercel

1. Importe o repositório no [Vercel](https://vercel.com).
2. Framework preset: **Vite**
3. Build command: `npm run build`
4. Output directory: `dist`
5. Instale e publique — não há variáveis de ambiente obrigatórias.

## Mobile

Layout responsivo (≤900px): mapa em tela cheia, abas **Central · Mapa · Ops**, painéis e overlays em bottom sheet.
