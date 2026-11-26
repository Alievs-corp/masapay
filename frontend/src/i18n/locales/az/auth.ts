// Azerbaijani texts of the "auth" namespace: the source the other languages follow.
export default {
  login: {
    title: 'masapay admin',
    subtitle: 'Email və şifrənizlə daxil olun',
    form: 'Giriş forması',
    email: 'Email',
    password: 'Şifrə',
    showPassword: 'Şifrəni göstər',
    hidePassword: 'Şifrəni gizlət',
    submit: 'Daxil ol',
    checking: 'Yoxlanılır...',
    invalid: 'Email və ya şifrə yanlışdır.',
    tooMany: 'Çox sayda cəhd oldu. Bir dəqiqə sonra yenidən yoxlayın.',
    failed: 'Giriş alınmadı. Yenidən cəhd edin.',
    noAccount:
      'Hesabınız yoxdursa, restoran meneceriniz və ya masapay administratoru onu yaratmalıdır.',
  },
  devLogin: {
    title: 'Lokal test girişi (şifrəsiz)',
    admin: 'Test admini (SUPER_ADMIN)',
    manager: 'Test meneceri (Dolma Restoran)',
    waiter: 'Test ofisiantı (Dolma Restoran)',
    chef: 'Test aşpazı (Dolma Restoran)',
    failed:
      'Test girişi alınmadı. Backend MASAPAY_DEV_LOGIN_ENABLED=true ilə işə salınmalıdır.',
  },
  password: {
    show: '{{field}}: göstər',
    hide: '{{field}}: gizlət',
    hint: '{{min}}-{{max}} simvol.',
    tooShort: 'Ən azı {{min}} simvol olmalıdır.',
  },
  resetPassword: {
    title: 'Yeni şifrə',
    description:
      '{{who}} üçün yeni şifrə. Köhnə şifrə dərhal işləməz olur; yenisini sahibinə təhlükəsiz yolla çatdırın.',
    field: 'Yeni şifrə',
    failed: 'Şifrəni dəyişmək alınmadı.',
    cancel: 'İmtina',
    saving: 'Yadda saxlanılır...',
    save: 'Şifrəni təyin et',
    done: '{{who}} üçün yeni şifrə təyin olundu.',
  },
  logout: 'Çıxış',
  guard: {
    checkingSession: 'Sessiya yoxlanılır',
    noAccessTitle: 'Giriş icazəniz yoxdur',
    noAccessBody:
      'Bu bölmə yalnız restoran menecerləri və administratorlar üçündür.',
  },
}
