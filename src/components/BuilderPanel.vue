<template>
    <section class="builder-panel">
        <h2 class="builder-title">Builder</h2>
        <p class="builder-placeholder">
            The visual builder for adapters, ports, methods, scenes, and rules will
            live here. For now, edit the JSON directly in the middle column and watch
            the live preview on the right.
        </p>
    </section>
</template>

<script>
export default {
    name: 'BuilderPanel',
};
</script>

<style lang="scss" scoped>
@use '@/styles/colors' as c;

.builder-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: #fff;
    border: 1px dashed c.$border;
    border-radius: 8px;
    overflow: auto;
}

.builder-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: c.$text-dark;
    margin: 0;
}

.builder-placeholder {
    font-size: 0.95rem;
    color: c.$text-dark;
    opacity: 0.7;
    line-height: 1.5;
}
</style>
