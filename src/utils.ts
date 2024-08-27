import type { IEventDoc } from './types'

export function getDomain(hostname: string) {
  const host = hostname.split('.')
  host.reverse()
  return `${host[1]}.${host[0]}`
}

export function getOnlineLocation(onlineLink: string) {
  const subHost = new URL(onlineLink).hostname
  const host = getDomain(subHost)
  return { 'google.com': 'Google Meet', 'zoom.us': 'Zoom' }[host] ?? 'Online'
}

export function getMapsLink(location: IEventDoc['location']) {
  return `https://www.google.com/maps/search/?api=1&query=${location.address}&query_place_id=${location.placeId}`
}
