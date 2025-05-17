<script lang="ts">

    import {Card} from "@sveltestrap/sveltestrap";
    import {onMount} from "svelte";

    type ElementType = {
        id: string
        title: string
    }

    export let elements: ElementType[]

    function isInViewport(el: HTMLElement) {
        const rect = el.getBoundingClientRect()
        return rect.top >= 0 && rect.bottom <= window.innerHeight - 400
    }

    let currentElementId: string = ''

    onMount(() => {
        let elementsArr: any = []

        if (elements) {
            elements.forEach((i: ElementType) => elementsArr.push(document.getElementById(i.id)))
        }

        window.addEventListener('scroll', () => {
            elementsArr.forEach((element: any) => {
                if (isInViewport(element)) {
                    currentElementId = element.id
                }
            })
        })

    })
</script>

<Card class="docs-nav">
    <ul class="nav bg-transparent flex-column">
        {#each elements as item}
            <li class="nav-item {currentElementId === item.id && 'active'}">
                <a href="#{item.id}" class="nav-link">{item.title}</a>
            </li>
        {/each}
    </ul>
</Card>