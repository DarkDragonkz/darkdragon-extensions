import {
    DUINavigationButton,
    SourceStateManager
} from '@paperback/types'

// Chiavi per lo State Manager
export const LOCG_USERNAME = 'locg_username'
export const LOCG_PASSWORD = 'locg_password'
export const LOCG_SESSION_COOKIE = 'locg_session_cookie' // Il famoso "ci_session"

export const getLocgCredentials = async (stateManager: SourceStateManager) => {
    const username = (await stateManager.retrieve(LOCG_USERNAME) as string) ?? ''
    const password = (await stateManager.retrieve(LOCG_PASSWORD) as string) ?? ''
    const sessionCookie = (await stateManager.retrieve(LOCG_SESSION_COOKIE) as string) ?? ''
    return { username, password, sessionCookie }
}

export const routeLocgSettings = (stateManager: SourceStateManager): DUINavigationButton => {
    return App.createDUINavigationButton({
        id: 'locg_settings',
        label: 'League of Comic Geeks Settings',
        form: App.createDUIForm({
            sections: async () => [
                App.createDUISection({
                    id: 'login',
                    header: 'Login Credentials',
                    footer: 'Inserisci le tue credenziali LOCG. Se il login automatico fallisce, inserisci manualmente il cookie "ci_session" dal browser.',
                    rows: async () => [
                        App.createDUIInputField({
                            id: 'username',
                            label: 'Username',
                            value: App.createDUIBinding({
                                get: async () => (await getLocgCredentials(stateManager)).username,
                                set: async (val) => await stateManager.store(LOCG_USERNAME, val)
                            })
                        }),
                        App.createDUIInputField({
                            id: 'password',
                            label: 'Password',
                            maskInput: true,
                            value: App.createDUIBinding({
                                get: async () => (await getLocgCredentials(stateManager)).password,
                                set: async (val) => await stateManager.store(LOCG_PASSWORD, val)
                            })
                        }),
                        App.createDUIInputField({
                            id: 'sessionCookie',
                            label: 'Session Cookie (Optional)',
                            value: App.createDUIBinding({
                                get: async () => (await getLocgCredentials(stateManager)).sessionCookie,
                                set: async (val) => await stateManager.store(LOCG_SESSION_COOKIE, val)
                            })
                        })
                    ]
                })
            ]
        })
    })
}