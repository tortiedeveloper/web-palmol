<script lang="ts">
    import { Card, CardBody, Button } from "@sveltestrap/sveltestrap";
    import type { User } from "$lib/types";
    import Icon from '@iconify/svelte';

    export let user: User;
    export let onViewProfile: (user: User) => void;
    let className = ''; // Variabel lokal untuk menampung kelas
    export { className as class };

    const defaultAvatar = '/images/users/avatar-default.png';

    function handleImageError(event: Event) {
        const target = event.target as HTMLImageElement;
        target.src = defaultAvatar;
    }
</script>

<Card class="h-100 d-flex flex-column {className || ''} {$$props.class || ''}">
    <CardBody class="d-flex flex-column flex-grow-1"> 
        <div class="text-center">
            <img 
                src={user.avatar || defaultAvatar} 
                alt="avatar-{user.name}"
                class="img-fluid avatar-xl img-thumbnail rounded-circle avatar-border mb-3"
                style="object-fit: cover; width: 100px; height: 100px;" on:error={handleImageError}
            />
            <h4 class="mt-1 fs-16 mb-1">
                <span class="text-dark">{ user.name || 'Nama Tidak Ada' }</span>
            </h4>

            {#if user.email}
            <p class="text-muted mb-1" style="font-size: 0.8rem;">
                <Icon icon="mdi:email-outline" class="me-1" style="vertical-align: -2px;"/>{ user.email }
            </p>
            {/if}

            {#if user.address}
            <p class="text-muted mb-1" style="font-size: 0.8rem;">
                <Icon icon="mdi:map-marker-outline" class="me-1" style="vertical-align: -2px;"/>{ user.address }
            </p>
            {/if}

            {#if user.phoneNumber}
            <p class="text-muted mb-2" style="font-size: 0.8rem;">
                <Icon icon="mdi:phone-outline" class="me-1" style="vertical-align: -2px;"/>{ user.phoneNumber }
            </p>
            {/if}
        </div>
        <div class="text-center mt-auto"> 
            <Button size="sm" color="primary" outline on:click={() => onViewProfile(user)} class="mt-2">
                Lihat Profil
            </Button>
        </div>
    </CardBody>
</Card>