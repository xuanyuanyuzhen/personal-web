<script setup>
defineOptions({
  name: 'NavigationTree',
});

defineProps({
  depth: {
    type: Number,
    default: 0,
  },
  items: {
    type: Array,
    required: true,
  },
  variant: {
    type: String,
    default: 'desktop',
  },
});

const emit = defineEmits(['navigate']);

function isExternal(item) {
  return item.kind === 'external';
}

function linkTarget(item) {
  return item.target || undefined;
}

function linkRel(item) {
  return item.target === '_blank' ? 'noreferrer' : undefined;
}

function handleNavigate() {
  emit('navigate');
}
</script>

<template>
  <ul
    class="navigation-tree"
    :class="[
      `navigation-tree-${variant}`,
      `navigation-tree-depth-${depth}`,
      { 'navigation-tree-nested': depth > 0 },
    ]"
  >
    <li
      v-for="item in items"
      :key="item.id"
      class="navigation-tree-item"
      :class="{ 'navigation-tree-item-has-children': item.children.length > 0 }"
    >
      <a
        v-if="isExternal(item)"
        :href="item.href"
        :target="linkTarget(item)"
        :rel="linkRel(item)"
        @click="handleNavigate"
      >
        {{ item.label }}
      </a>
      <RouterLink
        v-else
        :to="item.to"
        @click="handleNavigate"
      >
        {{ item.label }}
      </RouterLink>

      <NavigationTree
        v-if="item.children.length > 0"
        :depth="depth + 1"
        :items="item.children"
        :variant="variant"
        @navigate="handleNavigate"
      />
    </li>
  </ul>
</template>
