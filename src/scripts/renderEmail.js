async function main() {
  const renderEventEmail2 = await import('../../dist/email.esm.js')
  const fs = await import('fs/promises')
  await renderEventEmail2
    .renderEventEmail2({
      name: 'Mihai Daniel',
      event: {
        name: 'Curiosity Summit 3',
        backgroundImage:
          'https://trustmarketdevnet.blob.core.windows.net/eventmedia/7182e829-ccbb-440e-9b86-3732eaec262d/background.png',
        ticketImage:
          'https://devnet-media.xoxno.com/eventmedia/7182e829-ccbb-440e-9b86-3732eaec262d/ticket/7588fffa-1182-4573-8cd9-e8b094f5384a.png?ts=1726135086',
        time: '10-10 October 2024',
        location: {
          address:
            'Globalworth Campus, Bulevardul Dimitrie Pompeiu, Bucharest, Romania',
          lat: 44.480655,
          long: 26.118413,
          placeId: 'ChIJs8SR6oH4sUARi85xIWeSDVg',
        },
        ticketId: '41180fd5-141c-4ab9-aca3-c7cf8aa2c535',
        eventId: '7182e829-ccbb-440e-9b86-3732eaec262d',
      },
      unsubscribeToken:
        'ZWU2NTQ5ODdjOTlmMTBkYmNjZDEwNmFiZGNhNzQ3MmE6OTY1ZDllNTU1N2FmMjExMDY5Njg5MjliYjgwOWJiZWZiYmU5OTJmOWE1NjdmNWU4MjI2Y2IyZjVjZGY5NjQ1Nw==',
    })
    .then(async (email) => {
      await fs.writeFile(`invitation.html`, email.html)
      // return sendEmail({ email, to: 'poehland.bobo@gmail.com' })
    })
}

main()
