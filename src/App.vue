<template>
    <div id="layout">
        <nav>
            <a
                class="logo-link"
                href="https://spectrumintegrators.com"
                target="_blank"
                rel="noopener noreferrer"
                title="Spectrum Integrators">
                <img
                    id="logo"
                    :src="logoUrl"
                    alt="Spectrum Integrators" />
            </a>
            <h1 class="app-title">Zoom Rooms Control Profile Builder</h1>
        </nav>
        <main>
            <HomeView />
        </main>
        <footer>
            <a
                class="footer-link"
                :href="licenseUrl"
                target="_blank"
                rel="noopener noreferrer"
                title="View MIT License">
                Copyright &copy; 2026 Spectrum Integrators.
            </a>
            This site is not affiliated with, endorsed by, or sponsored by
            <a
                class="footer-link"
                href="https://zoom.us"
                target="_blank"
                rel="noopener noreferrer">
                Zoom Communications, Inc.
            </a>
            <span class="footer-sep">·</span>
            <a
                class="footer-link"
                :href="privacyUrl"
                target="_blank"
                rel="noopener noreferrer">
                Privacy
            </a>
        </footer>
    </div>
</template>

<script>
import HomeView from '@/views/HomeView.vue';
import logoUrl from '@/assets/logo.svg';

export default {
    name: 'App',
    components: { HomeView },
    data: () => ({
        logoUrl,
        // Use BASE_URL so the links still work when the app is hosted under
        // a subpath (GitHub Pages without a custom domain, etc).
        licenseUrl: import.meta.env.BASE_URL + 'LICENSE.txt',
        privacyUrl: import.meta.env.BASE_URL + 'privacy.html',
    }),
};
</script>

<style lang="scss">
@use '@/styles/colors' as c;

$navbar-height: 60px;
$footer-height: 22px;

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
    gap: 1rem;
    padding: 0 1rem;
    z-index: 1;

    .logo-link {
        display: block;
        height: calc(#{$navbar-height} - 16px);

        &:hover {
            opacity: 0.85;
        }
    }

    #logo {
        height: 100%;
        padding: 8px 0;
        width: auto;
        display: block;
    }

    .app-title {
        color: c.$text-light;
        font-size: 1.15rem;
        font-weight: 500;
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
}

main {
    flex: 1 1 auto;
    min-height: 0;
    padding: 8px;
}

footer {
    flex: 0 0 $footer-height;
    background: c.$primary;
    color: c.$text-light;
    font-size: 0.72rem;
    line-height: $footer-height;
    text-align: center;
    opacity: 0.85;
    padding: 0 1rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    .footer-link {
        color: inherit;
        text-decoration: underline;
        text-decoration-color: rgba(255, 255, 255, 0.4);
        text-underline-offset: 2px;

        &:hover {
            text-decoration-color: c.$text-light;
        }
    }

    .footer-sep {
        margin: 0 0.4rem;
        opacity: 0.5;
    }
}
</style>
