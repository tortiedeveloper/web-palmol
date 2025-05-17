<script lang="ts">
    import { Card, CardBody, Button, Badge } from "@sveltestrap/sveltestrap";
    // Pastikan tipe User (atau PKSUser) memiliki semua field yang ingin Anda tampilkan
    // seperti pksName (opsional dari slot), role, membership
    import type { User as PKSUser } from "$lib/types"; 
    import Icon from '@iconify/svelte';

    export let user: PKSUser;
    export let onViewProfile: (user: PKSUser) => void;
    let className = '';
    export { className as class };

    const defaultAvatar = '/images/users/avatar-default.png';

    function handleImageError(event: Event) {
        const target = event.target as HTMLImageElement;
        target.src = defaultAvatar;
    }
</script>

<Card class="h-100 d-flex flex-column shadow-sm card-hover-lift-sm {className || ''} {$$props.class || ''}">
    <CardBody class="d-flex flex-column flex-grow-1 p-3"> 
        <div class="text-center mb-3">
            <img 
                src={user.avatar || defaultAvatar} 
                alt="Avatar {user.name || 'Pengguna'}"
                class="rounded-circle img-thumbnail shadow-sm"
                style="width: 80px; height: 80px; object-fit: cover;" 
                on:error={handleImageError}
            />
            <h5 class="mt-3 mb-1 text-dark fw-semibold text-truncate" title={user.name || 'Nama Tidak Ada'}>
                {user.name || 'Nama Tidak Ada'}
            </h5>
            {#if user.role}
                <Badge color="soft-primary" pill class="fs-xs px-2">{user.role}</Badge>
            {/if}
        </div>

        <div class="contact-details mb-3">
            {#if user.email}
            <p class="text-muted fs-sm mb-1 text-truncate d-flex align-items-center" title={user.email}>
                <Icon icon="mdi:email-outline" class="me-2 flex-shrink-0" style="font-size: 1.1em;"/>
                <span class="text-truncate">{user.email}</span>
            </p>
            {/if}

            {#if user.phoneNumber}
            <p class="text-muted fs-sm mb-1 text-truncate d-flex align-items-center" title={user.phoneNumber}>
                <Icon icon="mdi:phone-outline" class="me-2 flex-shrink-0" style="font-size: 1.1em;"/>
                <span class="text-truncate">{user.phoneNumber}</span>
            </p>
            {/if}

            {#if user.address}
            <p class="text-muted fs-sm mb-0 text-truncate-lines d-flex align-items-start" title={user.address} style="max-height: 2.8em; line-height: 1.4;"> 
                <Icon icon="mdi:map-marker-outline" class="me-2 flex-shrink-0" style="font-size: 1.1em; margin-top: 0.15em;"/>
                <span class="text-truncate-lines-inner">{user.address}</span>
            </p>
            {/if}
        </div>

        <div class="contact-card-extra-info fs-xs text-muted text-center mb-3">
            <slot></slot> 
        </div>
        
        <div class="mt-auto"> 
            <Button size="sm" color="primary" outline on:click={() => onViewProfile(user)} class="w-100">
                <Icon icon="mdi:account-details-outline" class="me-1"/>Lihat Profil
            </Button>
        </div>
    </CardBody>
</Card>

<style>
    .fs-xs { font-size: 0.75rem; }
    .fs-sm { font-size: 0.875rem; }
    .text-truncate-lines {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        /* word-break: break-all; */ /* Bisa diaktifkan jika perlu pemotongan kata paksa */
    }
    .text-truncate-lines-inner { /* Untuk memastikan teks di dalamnya juga bisa di-truncate jika perlu (meskipun parent sudah) */
        display: block;
    }
</style>