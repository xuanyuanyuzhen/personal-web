<template>
  <div class="rich-editor">
    <Toolbar
      class="rich-editor-toolbar"
      :editor="editorRef"
      :default-config="toolbarConfig"
      :mode="editorMode"
    />
    <Editor
      :model-value="modelValue"
      class="rich-editor-body"
      :default-config="editorConfig"
      :mode="editorMode"
      data-testid="rich-text-editor"
      @on-created="handleCreated"
      @update:model-value="handleUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import '@wangeditor/editor/dist/css/style.css';

import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor';
import { Editor, Toolbar } from '@wangeditor/editor-for-vue';
import { onBeforeUnmount, shallowRef } from 'vue';

defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const editorRef = shallowRef<IDomEditor | null>(null);
const editorMode = 'default';
const toolbarConfig: Partial<IToolbarConfig> = {};
const editorConfig: Partial<IEditorConfig> = {
  placeholder: '请输入富文本内容',
};

function handleCreated(editor: IDomEditor) {
  editorRef.value = editor;
}

function handleUpdate(value: string) {
  emit('update:modelValue', value);
}

onBeforeUnmount(() => {
  editorRef.value?.destroy();
});
</script>
