const github = "/images/brands/github.svg"
const bitbucket = "/images/brands/bitbucket.svg"
const dribbble = "/images/brands/dribbble.svg"
const dropbox = "/images/brands/dropbox.svg"
const slack = "/images/brands/slack.svg"

const avatar1 = "/images/users/avatar-1.jpg"
const avatar3 = "/images/users/avatar-3.jpg"
const avatar5 = "/images/users/avatar-5.jpg"

import type {CategoryType, NotificationType} from "$lib/layouts/components/types";
import type {MenuItemType} from "$lib/types/menu";

export const categories: CategoryType[] = [
    {
        image: github,
        name: 'GitHub',
        username: '@reback'
    },
    {
        image: bitbucket,
        name: 'Bitbucket',
        username: '@reback'
    },
    {
        image: dribbble,
        name: 'Dribbble',
        username: '@username'
    },
    {
        image: dropbox,
        name: 'Dropbox',
        username: '@username'
    },
    {
        image: slack,
        name: 'Slack',
        username: '@reback'
    },
]

export const notifications: NotificationType[] = [
    {
        user: {avatar: avatar1},
        content: 'Josephine Thompson commented on admin panel "Wow 😍! this admin looks good and awesome design"'
    },
    {
        user: {name: 'Donoghue Susan'},
        message: 'Hi, How are you? What about our next meeting'
    },
    {
        user: {name: 'Jacob Gines', avatar: avatar3},
        message: 'Answered to your comment on the cash flow forecast\'s graph 🔔.'
    },
    {
        icon: 'iconamoon:comment-dots-duotone',
        title: 'You have received 20 new messages in the conversation'
    },
    {
        user: {name: 'Shawn Bunch', avatar: avatar5},
        content: 'Commented on Admin'
    },
]

export const profileMenuItems: MenuItemType[] = [
    {
        key: 'profile',
        label: 'Profile',
        icon: 'bx-user-circle',
        url: '/pages/profile'
    },
    {
        key: 'message',
        label: 'Message',
        icon: 'bx-message-dots',
        url: '/apps/chat'
    },
    {
        key: 'pricing',
        label: 'Pricing',
        icon: 'bx-wallet',
        url: '/pages/pricing'
    },
    {
        key: 'help',
        label: 'Help',
        icon: 'bx-help-circle',
        url: '/pages/faqs'
    },
    {
        key: 'lock-screen',
        label: 'Lock Screen',
        icon: 'bx-lock',
        url: '/auth/lock-screen'
    },
]