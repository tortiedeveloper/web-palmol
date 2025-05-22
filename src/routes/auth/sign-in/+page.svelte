<script lang="ts">
    import AuthLayout from "$lib/layouts/AuthLayout.svelte";
    import LogoBox from "$lib/components/LogoBox.svelte";
    import { Button, Card, CardBody, Col, Input, Row, Alert } from "@sveltestrap/sveltestrap";
    import { auth } from '$lib/firebase/client';
    import { signInWithEmailAndPassword, type User as FirebaseUserType } from 'firebase/auth'; // Ganti nama User agar tidak bentrok
    import { getFunctions, httpsCallable } from 'firebase/functions';
    import { goto, invalidateAll } from '$app/navigation'; // invalidateAll mungkin berguna
    import { page } from '$app/stores';
    import { onMount } from 'svelte';

    let email = '';
    let password = '';
    let errorMsg: string | null = null;
    let isLoading = false;

    // onMount untuk redirect jika sudah login (opsional jika hooks.server.ts sudah handle)
    onMount(() => {
        // Jika ingin redirect dari client-side berdasarkan auth.currentUser
        // Sebaiknya ini ditangani oleh hooks.server.ts untuk konsistensi
        if (auth.currentUser && $page.data.userSession) { // userSession dari root layout server
             const claims = ($page.data.userSession || {});
             if (claims.hasGanoAIAccess) {
                 goto('/dashboards/analytics-gano', { replaceState: true });
             } else if (claims.hasRipenessAccess) {
                 goto('/dashboards/analytics-ripeness', { replaceState: true });
             }
        }
    });

    async function handleLogin(event: SubmitEvent) {
        event.preventDefault();
        if (!email || !password) {
            errorMsg = "Email dan password harus diisi.";
            return;
        }
        isLoading = true;
        errorMsg = null;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            if (user) {
                console.log("[Sign-In] Firebase login berhasil, UID:", user.uid);

                // Panggil Firebase Function untuk set custom claims
                const functions = getFunctions(auth.app, 'asia-southeast2');
                const manageClaims = httpsCallable(functions, 'manage_user_access_claims');
                console.log("[Sign-In] Memanggil manage_user_access_claims Function...");
                await manageClaims(); // Tunggu hingga selesai
                console.log("[Sign-In] manage_user_access_claims Function selesai.");

                // Dapatkan ID token terbaru yang berisi custom claims
                console.log("[Sign-In] Refresh ID Token...");
                const idToken = await user.getIdToken(true);
                console.log("[Sign-In] ID Token berhasil di-refresh.");

                // BARU: Kirim ID token ke server untuk membuat session cookie
                console.log("[Sign-In] Mengirim token ke /api/auth/session...");
                const response = await fetch('/api/auth/session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ token: idToken }),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: "Gagal membuat sesi server." }));
                    throw new Error(errorData.message || `Server error: ${response.status}`);
                }
                
                const sessionResult = await response.json();
                console.log("[Sign-In] Respons dari /api/auth/session:", sessionResult);

                if (sessionResult.status === 'success') {
                    // Ambil claims dari respons /api/auth/session atau refresh token lagi untuk dapat dari client
                    // Untuk simpelnya, kita bisa ambil dari respons jika endpoint mengembalikannya,
                    // atau kita bisa andalkan hooks.server.ts untuk mempopulasi locals.user dari cookie
                    // dan +layout.server.ts akan mengambilnya.
                    
                    // Penting: invalidateAll() untuk memastikan +layout.server.ts berjalan lagi
                    // dan mengambil locals.user yang baru (dari cookie)
                    await invalidateAll(); 

                    // Arahkan berdasarkan klaim yang seharusnya sudah bisa dibaca server dari cookie
                    // Kita bisa juga membaca klaim dari sessionResult jika endpoint mengembalikannya.
                    // Untuk sekarang, kita andalkan server untuk membaca cookie pada navigasi berikutnya.
                    // Mari kita ambil claims dari token yang sudah di-refresh di klien untuk keputusan redirect awal.
                    const idTokenResultAfterSession = await user.getIdTokenResult(true); // Dapatkan claims terbaru lagi
                    const claims = idTokenResultAfterSession.claims;

                    console.log("[Sign-In] Claims setelah sesi server:", claims);

                    if (claims.hasGanoAIAccess) {
                        console.log("[Sign-In] Redirecting ke GanoAI Dashboard...");
                        goto('/dashboards/analytics-gano', { replaceState: true });
                    } else if (claims.hasRipenessAccess) {
                        console.log("[Sign-In] Redirecting ke Ripeness Dashboard...");
                        goto('/dashboards/analytics-ripeness', { replaceState: true });
                    } else {
                        errorMsg = "Anda tidak memiliki akses ke modul manapun setelah sesi server dibuat.";
                        // Logout Firebase client & server session jika tidak ada akses
                        await fetch('/api/auth/logout', { method: 'POST' }); // Hapus cookie server
                        await auth.signOut(); // Logout Firebase client
                    }
                } else {
                    throw new Error(sessionResult.message || "Gagal membuat sesi di server.");
                }
            }
        } catch (err: any) {
            console.error("[Sign-In] Login atau proses sesi error:", err);
            if (err.code && err.message && typeof err.code === 'string' && err.code.startsWith('auth/')) {
                errorMsg = "Email atau password salah."; // Pesan generik untuk error auth Firebase
            } else {
                errorMsg = err.message || "Terjadi kesalahan saat login atau mengatur sesi.";
            }
        } finally {
            isLoading = false;
        }
    }
</script>

<AuthLayout>
    <Col xl="5" md="7" sm="9">
        <Card class="auth-card">
            <CardBody class="p-0">
                <div class="p-4">
                    <div class="mx-auto mb-4 text-center auth-logo"> <LogoBox/> </div>
                    <h2 class="fw-bold text-center fs-18">Sign In</h2>
                    <p class="text-muted text-center mt-1 mb-4">Akses panel admin Sawit Pintar.</p>
                    <Row class="justify-content-center">
                        <Col md="10" xs="12">
                            <form on:submit={handleLogin} class="authentication-form">
                                {#if errorMsg}
                                    <Alert color="danger" class="mb-3">{errorMsg}</Alert>
                                {/if}
                                <div class="mb-3">
                                    <label class="form-label" for="email-input">Email</label>
                                    <Input type="email" id="email-input" name="email" bind:value={email} placeholder="Masukkan email Anda" required disabled={isLoading}/>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" for="password-input">Password</label>
                                    <Input type="password" id="password-input" name="password" bind:value={password} placeholder="Masukkan password Anda" required disabled={isLoading}/>
                                </div>
                                <div class="mb-3 text-center d-grid">
                                    <Button color="primary" type="submit" disabled={isLoading}>
                                        {#if isLoading} <span class="spinner-border spinner-border-sm me-1"></span> Signing In... {:else} Sign In {/if}
                                    </Button>
                                </div>
                            </form>
                        </Col>
                    </Row>
                </div>
            </CardBody>
        </Card>
    </Col>
</AuthLayout>