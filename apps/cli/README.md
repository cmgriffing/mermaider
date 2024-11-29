# Mermaider CLI

## Installation

```bash
npm install -g @mermaider/cli
# or
yarn global add @mermaider/cli
# or
pnpm add -g @mermaider/cli
```

## Usage

> Note: You will need an ANTHROPIC_API_KEY environment variable set to use the CLI.

```bash
mermaider parse ./path/to/file.ts
```

This will generate a `.mmd` file and a `.svg` file in the same directory as the file.

If you want to pass your API key to the CLI for a single run you can run the command like so:

```bash
ANTHROPIC_API_KEY=your-api-key mermaider parse ./path/to/file.ts
```

## Contributing

Please see the [contributing guide](../../CONTRIBUTING.md) for more information.

## License

[MIT](../../LICENSE)
