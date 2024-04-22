![WebRTC barebones for Scratch](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/098cb8b2-d002-4681-a3b5-4515be306c99)

# Barebones WebRTC for Scratch 3
A slimmed-down version of the CL5 protocol extension, designed to offer a basic implementation of the WebRTC standard for Scratch 3.

# Usage

## Creating connection objects
For every connection you want to make, you must initialize a new [RTCPeerConnection](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection) object. Use this block to get started.

![create peer connection block](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/bb4269b2-88f3-4053-93f5-cbbb2dc5ce9b)

You can check a list of all existing objects using this reporter. I suggest using a JSON extension to simplify this for you.

![all peer connection objects reporter](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/11bfd69f-4257-4384-a31f-d82b6b2689d2)

You can use this reporter to list all *active and connected* objects instead:

![all connected peers reporter](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/d6c45107-de86-4d5c-a86d-74131c6d597d)

## Disclaimers
⚠️ Since this is a barebones implementation of WebRTC, *there is no automated signaling for you. **You are solely responsible for negotiating connections.***

👍 WebRTC does not specify any transport for signaling, so this provides you plently of room for freedom. 

This could be accompished via:
* ☁️ Cloud variables ([make sure to use encryption](https://github.com/cloudlink-omega/e2ee), as EVERYONE will be able to see your data)
* 🌐 REST APIs
* 💬 WebSockets
* 🕊️ [An army of carrier pigeons... or doves?](https://cpoonolly.com/pigeon-rtc/)

Just as long as you got some way to send a message from point A to B, you're set.

🐌🧊 **This extension does NOT implement [Trickle ICE](https://bloggeek.me/webrtcglossary/trickle-ice/)** - Negotiating connections *will be slow.*

If you want a fully-automated solution with Trickle ICE, [consider using CL5 instead.](github.com/cloudlink-omega/cl5)

## Signaling flow
Let's say that we have two people that want to connect: Alice and Bob.

Both Alice and Bob will create connection objects for the both of them. Alice will create a "Bob" connection object, and Bob will create a "Alice" connection object.

![create peer connection block](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/bb4269b2-88f3-4053-93f5-cbbb2dc5ce9b)

Alice will use this block to create a offer for Bob:

![make offer block](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/d7f216a9-661d-4246-b240-31629512ef46)

From here, Alice will somehow provide Bob with a Base64-encoded [RTCSessionDescription](https://developer.mozilla.org/en-US/docs/Web/API/RTCSessionDescription) using this reporter's output:

*Note: This data is **ENCODED**; not **ENCRYPTED.** Make sure to [encrypt the offer](https://github.com/cloudlink-omega/e2ee) if you choose to send it over an insecure transport (such as cloud variables). otherwise, very bad things can happen!*

![offer reporter](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/6300ad74-6d4e-4290-a759-73eb58e7c663)

Now, on Bob's device, Bob will take Alice's Base64-encoded offer and generate an answer:

![make answer block](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/ec309eda-5d31-44f0-97a8-a3b8dfa83fa7)

Bob will somehow send a Base64-encoded answer to Alice using the value provided by this reporter:

*Note: Again, this data is **ENCODED**; not **ENCRYPTED.** PLEASE make sure to encrypt it!!!*

![answer reporter](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/78b19516-604b-41ff-8a34-9067325766ca)

On Alice's end, she will take Bob's answer and handle it:

![handle answer block](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/20c8b5fe-d08c-477f-aa2d-81f04091bbb1)

At this point, Alice and Bob's browsers need to negotiate the most optimal connection to use. WebRTC utilizes ICE ([Interactive Connectivity Establishment protocol](https://www.digitalsamba.com/blog/ice-and-sdp-in-webrtc)) to make this happen. 

Both Alice and Bob will need to wait until all ICE candidates are gathered, which can be accomplished using this block:

![gather ice candidates block](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/07865d60-835b-4e67-9652-109357a1bc9b)

Once either Bob or Alice has finished gathering ICE candidates, they can send the value of this reporter to each other:

*Note: Likewise, this data is **ENCODED**; not **ENCRYPTED.** I really, REALLY hope you're encrypting it!*

![ice candidates reporter](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/b94cd1f2-a15e-4ffd-8333-e36ae9d2ee58)

On opposing ends, Alice or Bob can accept their respective ICE candidates using this handler:

![handle ice block](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/e8da5131-7e89-4c27-99e1-5c2d9ae95209)

After this point, Alice and Bob's browsers will silently establish a connection, and they can now send data!

# Sending data
To send data, simply use this block:

![send data block](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/99bbe970-6929-43c5-b8f9-57b166cdeae6)

On the other end, use this reporter to read the received data:

![received data reporter](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/b5e2463a-64a4-4f4d-9243-375cf5dc2461)

## Channels
All connections will have the `default` [RTCDataChannel](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel), which is configured for ordered and reliable messaging. This sacrifices speed for accuracy.

You can create as many channels as you wish (though there may be a browser limitation to this). You can also create unordered channels to prioritize speed, however, messages might not be seen by the recipient if this mode is chosen.

![create channel block](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/54839584-8618-4655-9a66-ae7141a7918b)

Once you are done using a channel, you can simply close it (You cannot close the `default` data channel using this block. You must close the entire connection to do so).

![close channel block](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/3e0960d9-a053-44fe-85ea-c689b7ecd00e)

If you need to check if a channel exists, you can use this boolean block:

![does channel exist boolean](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/9bd5182f-e235-495f-9cfb-a8440e9b5e84)

# Closing connections
When you are done, you can close the connection by using this block:

![close connection block](https://github.com/cloudlink-omega/scratch3-webrtc/assets/12957745/63b9c6dd-18c8-4931-870d-21c624b49f8a)

All data channels will be silently closed, and the peer connection object will be destroyed.
