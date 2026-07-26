/// <reference types="vite/client" />

declare module '*.html?raw' {
  const content: string;
  export default content;
}

declare module '@components/templates/*.html?raw' {
  const content: string;
  export default content;
}

declare module '@views/templates/*.html?raw' {
  const content: string;
  export default content;
}

declare module '*.md?raw' {
  const content: string;
  export default content;
}
