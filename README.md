# Parchment Maps – Landing

Quickstart

```bash
# dev
bun install
bun run dev

# build static
bun run generate

# preview
bun run preview
```

Features

- Nuxt 4 + Tailwind CSS
- Minimal landing scaffold
- Server routes: auth status + waitlist
- Simple A/B variant via cookie

---

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Globe textures (offline build)

Generate high‑quality equirectangular textures (albedo, roughness, bump) from open datasets:

```bash
brew install gdal imagemagick   # prerequisites (macOS)
chmod +x scripts/build-globe-textures.sh
SIZE_W=16384 SIZE_H=8192 ./scripts/build-globe-textures.sh
```

Outputs are written to `public/textures/globe/`:
- `earth_albedo.png`
- `earth_roughness.png`
- `earth_bump.png`

Adjust the color ramp at `scripts/colors-standard.txt` to tune the palette.
