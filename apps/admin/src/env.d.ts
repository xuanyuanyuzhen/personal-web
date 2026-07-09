declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare module '@wangeditor/editor-for-vue' {
  import type { DefineComponent } from 'vue';

  export const Editor: DefineComponent<object, object, unknown>;
  export const Toolbar: DefineComponent<object, object, unknown>;
}
