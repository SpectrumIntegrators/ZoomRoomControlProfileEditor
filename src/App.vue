<template>
    <div id="layout">
        <nav>
            <img
                id="logo"
                :src="logoUrl"
                alt="Spectrum Integrators" />
        </nav>
        <main>
            <HomeView />
        </main>
    </div>
</template>

<script>
import HomeView from '@/views/HomeView.vue';
import logoUrl from '@/assets/logo.svg';

export default {
    name: 'App',
    components: { HomeView },
    data: () => ({ logoUrl }),
};
</script>

<style lang="scss">
@use '@/styles/colors' as c;

$navbar-height: 60px;

#layout {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
}

nav {
    flex: 0 0 $navbar-height;
    background: c.$primary;
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 0 1rem;
    z-index: 1;

    #logo {
        height: calc(#{$navbar-height} - 16px);
        padding: 8px 0;
        width: auto;
        display: block;
    }
}

main {
    flex: 1 1 auto;
    min-height: 0;
    padding: 8px;
}
</style>
