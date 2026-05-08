# Inkwell

Browser extension for translating Japanese light novels into Chinese using LLMs.

## Features

- **6 supported website**: Syosetu, Kakuyomu, Alphapolis, Hameln, Pixiv
- **Quality LLM-powered translation**: keyword extraction, glossary injection, structural scoring
- **Preemptive translation**: Background fetch + translate next chapter while you read
- **Local caching**: Dexie.js (IndexedDB) for novels, chapters, keywords, translation cache

## Stack

[WXT](https://wxt.dev/) · [Preact](https://preactjs.com/) · [Tailwind CSS](https://tailwindcss.com/) · TypeScript · [Dexie.js](https://dexie.org/) · [Vitest](https://vitest.dev/)

## How we keep LLM translation high quality?

We recommend **deepseek-v4-flash** (thinking disabled). It produces natural-sounding translations with correct formatting at about 0.005 USD per chapter (with prompt caching). The entire extension is tuned for this model.

For structural quality, we use **cumulative boundaries** to detect anomalies like misplaced line breaks or mixed-language sentences. Instead of vaguely telling the LLM to "fix it," we algorithmically repair what we can, then **pinpoint the exact location of remaining anomalies** and pass those coordinates to the LLM for targeted correction. This gives the model precise context and consistently yields cleaner output.

## LLM model

We recommend deepseek V4 Flash with thinking disabled, which cost about 0.005 USD per 6000 chapter with prompt caching enabled.
