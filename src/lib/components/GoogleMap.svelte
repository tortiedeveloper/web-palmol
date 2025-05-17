<script lang="ts">

    import {onMount} from "svelte";
    import {Loader, type LoaderOptions,} from "google-maps";

    export let id: string
    export let options: object = {}

    onMount(async () => {

        const loaderOptions: LoaderOptions = {};
        const loader = new Loader('AIzaSyAOVYRIgupAurZup5y1PRh8Ismb1A3lLao', loaderOptions);

        const google = await loader.load();

        const ele = document.getElementById(id)

        if (ele) {
            const map = new google.maps.Map(ele, options);
            const marker = new google.maps.Marker({
                position: {lat: -12.043333, lng: -77.028333,},
                map: map,
                title: 'Hello San Francisco!'
            });
        }
    })

</script>


<div id="{id}" class="gmaps"></div>