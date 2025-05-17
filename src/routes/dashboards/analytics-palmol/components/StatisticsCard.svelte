<script lang="ts">
    import {Card, CardBody, Row, Col} from '@sveltestrap/sveltestrap';
    import Icon from "@iconify/svelte";
    import type {StatisticCardType} from "$lib/types";

    export let item: StatisticCardType;
    let className = ''; // Variabel lokal untuk menampung kelas
    export { className as class }; // Ekspor 'className' sebagai prop 'class'
</script>

<Card class="{className || ''} {$$props.class || ''}">
    <CardBody>
        <Row class="align-items-center">
            <Col xs="auto" class="flex-shrink-0">
                <div class={`avatar-md bg-opacity-10 rounded bg-${item.variant}`}>
                    <span class="avatar-title d-flex align-items-center justify-content-center">
                        <Icon icon={item.icon} class={`text-${item.variant}`} height="28"/>
                    </span>
                </div>
            </Col>
            <Col class="flex-grow-1 ms-3">
                <p class="text-muted mb-1 text-truncate">
                    {item.title}
                </p>
                <h4 class="text-dark my-0">
                    {#if (item.prefix)}
                        <span>{item.prefix}</span>
                    {/if}
                    {item.statistic}
                    {#if (item.suffix)}
                        <span>{item.suffix}</span>
                    {/if}
                </h4>
            </Col>
        </Row>
    </CardBody>
</Card>