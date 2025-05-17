<script lang="ts">
    import {Swiper} from "swiper";
    import {onMount} from "svelte";
    import type {SwiperOptions} from "swiper/types";

    export let id: string
    export let customClass: string = ''
    export let options: SwiperOptions
    export let style: string = ''

    onMount(() => {
        new Swiper(`#${id}`, options)
    })
</script>


<div class="swiper {customClass}" id={id} style={style}>
    <slot/>
</div>