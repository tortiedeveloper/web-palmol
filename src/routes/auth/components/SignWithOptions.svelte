<script lang="ts">
    type OptionType = {
        icon: string
        name: string
        url: string
    }

    const signWithOptions: OptionType[] = [
        {
            icon: 'bxl-google',
            name: 'Google',
            url: ''
        },
        {
            icon: 'bxl-facebook',
            name: 'Facebook',
            url: ''
        },
        {
            icon: 'bxl-github',
            name: 'Github',
            url: ''
        }
    ]
</script>

<div class="text-center d-flex justify-content-center gap-1">
    {#each signWithOptions as item}
        <a href={item.url} class="btn btn-light shadow-none">
            <i class="bx fs-20 {item.icon}"/>
        </a>
    {/each}
</div>