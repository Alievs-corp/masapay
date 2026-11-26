# RBAC — Rollar və İcazə Matrisi

masapay dörd rol istifadə edir. Rollar `users.role` sütununda saxlanılır və giriş
zamanı JWT access token-ə `role` claim-i kimi yazılır; hər sorğuda
`JwtAuthenticationFilter` bunu `ROLE_<rol>` authority-sinə çevirir. Endpoint-lər
`@PreAuthorize` ilə qorunur (`@EnableMethodSecurity`).

## Rollar

- **SUPER_ADMIN** — platforma sahibi. Bütün restoranları, bütün hesabları
  (istənilən rol, istənilən restoran) və qlobal tənzimləmələri idarə edir.
- **RESTO_MANAGER** — bir restoranın meneceri. Yalnız öz restoranını idarə edir
  (öz ofisiant və aşpazları, masalar, adisyonlar, ödəniş/POS tənzimləmələri,
  refund, analitika).
- **WAITER** — restoran işçisi. Öz restoranının masalarına və adisyonlarına
  xidmət edir; idarəetmə icazəsi yoxdur.
- **CHEF** — aşpaz. Öz restoranının mətbəx ekranını görür; idarəetmə icazəsi
  yoxdur.

## Hesablar və giriş

- Giriş email və şifrə ilədir (`POST /api/auth/login`). Səhv email, səhv şifrə,
  şifrəsi olmayan və ya deaktiv hesab üçün cavab eynidir: **401** "Invalid email
  or password".
- **Özünü qeydiyyat yoxdur.** Hər hesabı başqası yaradır:
  - SUPER_ADMIN istənilən hesabı yaradır və idarə edir (o cümlədən
    RESTO_MANAGER və başqa SUPER_ADMIN-lər).
  - RESTO_MANAGER yalnız öz restoranı üçün WAITER və CHEF hesabları yaradır və
    idarə edir. Başqa restoranlara, başqa menecerlərə və super adminlərə
    toxuna bilməz.
- Hər daxil olmuş istifadəçi öz şifrəsini dəyişə bilər (cari şifrə + yeni şifrə).
- Şifrə siyasəti hər yerdə eynidir: 10–128 simvol. Pozulsa **400** və
  `detail`-də sahənin adı ilə səbəb qayıdır.
- İlk SUPER_ADMIN başlanğıcda `MASAPAY_SUPER_ADMIN_EMAILS` və
  `MASAPAY_SUPER_ADMIN_PASSWORD` ilə yaradılır. Artıq şifrəsi olan hesabın
  şifrəsi heç vaxt üzərinə yazılmır.
- SUPER_ADMIN öz hesabını deaktiv edə və ya rolunu endirə bilməz (platforma
  girişsiz qalmasın deyə): **409**.

## İcazə matrisi

| Resurs / Əməliyyat | SUPER_ADMIN | RESTO_MANAGER | WAITER / CHEF | Public |
|---|:---:|:---:|:---:|:---:|
| `GET /actuator/health`, `/info` | - | - | - | bəli |
| `POST /api/auth/login`, `/refresh`, `/logout` | - | - | - | bəli |
| `POST /api/auth/password` (öz şifrəsini dəyişmək) | bəli | bəli | bəli | xeyr |
| `GET /api/me` (öz profili) | bəli | bəli | bəli | xeyr |
| `GET /api/admin/users` (bütün hesablar) | bəli | xeyr | xeyr | xeyr |
| `POST /api/admin/users` (hesab yarat, istənilən rol) | bəli | xeyr | xeyr | xeyr |
| `PATCH /api/admin/users/{id}` (aktiv/deaktiv, rol, restoran, ad) | bəli (özünü deaktiv / endirmək olmaz) | xeyr | xeyr | xeyr |
| `PUT /api/admin/users/{id}/password` (şifrəni yenilə) | bəli | xeyr | xeyr | xeyr |
| `POST /api/admin/platform/restaurants` (restoran + ilk menecer hesabı) | bəli | xeyr | xeyr | xeyr |
| `POST /api/admin/platform/restaurants/{id}/managers` (menecer hesabı) | bəli | xeyr | xeyr | xeyr |
| `GET /api/admin/restaurants/{id}/staff` | bütün | öz restoranı | xeyr | xeyr |
| `POST /api/admin/restaurants/{id}/staff` (WAITER/CHEF hesabı) | bütün | öz restoranı, yalnız WAITER/CHEF | xeyr | xeyr |
| `PATCH /api/admin/restaurants/{id}/staff/{userId}` (rol WAITER/CHEF, aktiv/deaktiv) | bütün | öz restoranının WAITER/CHEF-i | xeyr | xeyr |
| `PUT /api/admin/restaurants/{id}/staff/{userId}/password` | bütün | öz restoranının WAITER/CHEF-i | xeyr | xeyr |

Restoran resursları üçün ümumi siyasət:

| Resurs / Əməliyyat | SUPER_ADMIN | RESTO_MANAGER | WAITER | CHEF |
|---|:---:|:---:|:---:|:---:|
| Restoran tənzimləmələri (POS/Payriff) | bütün | öz restoranı | xeyr | xeyr |
| Masa / QR idarəetməsi | bütün | öz restoranı | öz restoranı | xeyr |
| Canlı adisyonlar və floor plan | bütün | öz restoranı | öz restoranı | xeyr |
| Mətbəx ekranı | bütün | öz restoranı | xeyr | öz restoranı |
| Refund | bütün | öz restoranı | xeyr | xeyr |
| Analitika / hesabatlar | bütün | öz restoranı | xeyr | xeyr |

## Cavab kodları

- Autentifikasiya yoxdursa (token yox / vaxtı bitib / etibarsız) və ya giriş
  rədd edilibsə: **401** (`RestAuthenticationEntryPoint`, `AuthController`).
- Autentifikasiya var, lakin rol icazəsi yoxdursa və ya başqa restorandırsa:
  **403** (`@PreAuthorize` və servis yoxlamaları).
- Başqa restoranın işçisi, menecer və ya super admin menecerin staff
  endpoint-lərindən görünmür: **404**.
- Email artıq başqa hesabdadırsa (hərf ölçüsündən asılı olmayaraq): **409**.
