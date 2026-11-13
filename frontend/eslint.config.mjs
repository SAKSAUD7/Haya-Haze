import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  { ignores: [".next/**", "node_modules/**", "src/lib/api/schema.d.ts", "scripts/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // three.js / R3F intrinsic elements use props ESLint's React plugin does not know.
      "react/no-unknown-property": "off",
    },
  },
];

export default config;
