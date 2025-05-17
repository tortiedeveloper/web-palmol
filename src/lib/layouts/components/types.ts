export type CategoryType = {
    image: string
    name: string
    username: string
}

type MessageType = {
    user?: {
        avatar?: string
        name?: string
    }
    message?: string
}

export type NotificationType = {
    icon?: string
    title?: string
    content?: string
} & MessageType