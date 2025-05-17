<script lang="ts">
    import {onMount} from "svelte";

    const favicon = '/images/favicon.ico';

    // import 'simplebar'
    import 'simplebar/dist/simplebar.css';
    import 'swiper/css'
    import 'swiper/css/scrollbar'
    import 'swiper/css/navigation'
    import 'swiper/css/pagination'
    import 'swiper/css/effect-fade'
    import 'swiper/css/effect-flip'
    import 'swiper/css/effect-creative'
    import 'dropzone/src/dropzone.scss'
    import 'flatpickr/dist/flatpickr.css'
    import 'apexcharts/dist/apexcharts.css'
    import 'nouislider/dist/nouislider.css'
    import 'gridjs/dist/theme/mermaid.min.css'
    import 'quill/dist/quill.core.css'
    import 'quill/dist/quill.snow.css'
    import 'quill/dist/quill.bubble.css'
    import 'choices.js/src/styles/choices.scss'

    import 'mapbox-gl/dist/mapbox-gl.css';

    import '$lib/assets/scss/app.scss'
    import '$lib/assets/scss/icons.scss'

    import {initLayout} from "$lib/stores/layout";

    onMount(() => {
        initLayout()
    })
</script>


<svelte:head>
    <title>Palmol</title>
    <meta
            name="description"
            content="A fully responsive premium admin dashboard template"
    />
    <meta name="author" content="Techzaa"/>

    <link rel="shortcut icon" href={favicon}/>
</svelte:head>

<slot/>