// Azerbaijani texts of the "staff" namespace: the source the other languages follow.
export default {
  roles: {
    WAITER: 'Ofisiant',
    CHEF: 'Aşpaz',
  },
  status: {
    ACTIVE: 'Aktiv',
    DEACTIVATED: 'Deaktiv',
  },
  page: {
    title: 'İşçilər',
    description:
      'Ofisiant və aşpaz hesablarını ad, email və şifrə ilə yaradın: dərhal daxil ola bilərlər. Şifrəni işçiyə təhlükəsiz yolla çatdırın; o, Tənzimləmələrdə onu dəyişə bilər.',
    createForm: 'İşçi hesabı yarat',
    name: 'Ad',
    namePlaceholder: 'Ad Soyad',
    email: 'Email',
    emailPlaceholder: 'ad.soyad@mail.az',
    password: 'Şifrə',
    role: 'Rol',
    create: 'Hesab yarat',
    creating: 'Yaradılır...',
    emailTaken: 'Bu email ilə artıq hesab var.',
    createFailed: 'Hesabı yaratmaq alınmadı. Məlumatları yoxlayın.',
    updateFailed: 'Dəyişiklik alınmadı.',
    loading: 'Yüklənir',
    loadFailed: 'İşçiləri yükləmək alınmadı.',
    columns: {
      member: 'İşçi',
      role: 'Rol',
      status: 'Vəziyyət',
      actions: 'Əməliyyat',
    },
    noPassword: 'Şifrə yoxdur: yenisini təyin edin',
    roleAria: '{{email}} rolu',
    activateAria: '{{email}} aktiv et',
    activate: 'Aktiv et',
    deactivateAria: '{{email}} deaktiv et',
    deactivate: 'Deaktiv et',
    resetPasswordAria: '{{email}} üçün yeni şifrə',
    resetPassword: 'Şifrə',
    empty:
      'Hələ işçi yoxdur. Yuxarıdan ilk ofisiant və ya aşpaz hesabını yaradın.',
  },
}
