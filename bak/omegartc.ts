// Define customized types
class PeerConnection extends RTCPeerConnection {
    name: string
    constructor(configuration: RTCConfiguration) {
        super(configuration)
    } 
}

interface Configuration extends RTCConfiguration {
    supportsTrickleIce: boolean
}

// OmegaRTC is a simple browser-oriented class that provides a uniform interface to manage multiple WebRTC connections.
// This class can be used for both voice connections and data connections with multiple channels.
class OmegaRTC {
    
    // Properties and types for data connections
    dataConnections: Map<string, PeerConnection>
    dataChannels: Map<string, Map<string, RTCDataChannel>>
    dataStorage: Map<string, Map<string, any>>
    dataIceCandidates: Map<string, Array<RTCIceCandidate>>
    dataIceDone: Map<string, boolean>

    // Properties and types for voice connections
    voiceConnections: Map<string, PeerConnection>
    voiceStreams: Map<string, Array<MediaStream>>
    voiceIceCandidates: Map<string, Array<RTCIceCandidate>>
    voiceIceDone: Map<string, boolean>
    
    // Type for configuration
    configuration: Configuration

    // Type for event handlers
    eventHandlers: Map<string, Array<(...args: any[]) => void>>

    // Constructor for OmegaRTC
    constructor() {
        this.dataConnections = new Map()
        this.dataChannels = new Map()
        this.dataStorage = new Map()
        this.dataIceCandidates = new Map()
        this.dataIceDone = new Map()
        this.voiceConnections = new Map()
        this.voiceStreams = new Map()
        this.voiceIceCandidates = new Map()
        this.voiceIceDone = new Map()
        this.eventHandlers = new Map()
        this.configuration = {
            iceServers: [
              { urls: 'stun:vpn.mikedev101.cc:3478' },
              {
                urls: 'turn:vpn.mikedev101.cc:3478',
                username: 'free',
                credential: 'free'
              },
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:freeturn.net:3478' },
              { urls: 'stun:freeturn.net:5349' },
              {
                urls: 'turn:freeturn.net:3478',
                username: 'free',
                credential: 'free'
              },
              {
                urls: 'turns:freeturn.net:5349',
                username: 'free',
                credential: 'free'
              }
            ],
            iceTransportPolicy: 'all',
            supportsTrickleIce: false,
        } as Configuration
    }
    
    /**
     * Gets an array of all peers from dataConnections.
     * 
     * @return {Array<string>} The list of peers.
     */
    getPeers() : Array<string> {
        let output = new Array()
    
        // Convert each entry of dataConnections into [name] format
        let peers = Array.from(this.dataConnections.keys())
        Array.from(peers).forEach((id) => output.push(id))

        return output
    }

    /**
     * Gets an array of connected peers from dataConnections.
     * 
     * @return {Array<string>} The list of connected peers.
     */
    getConnectedPeers() : Array<string> {
        let output = new Array()
    
        // Convert each entry of dataConnections into [name] format
        let peers = Array.from(this.dataConnections.keys())
        Array.from(peers).forEach((id) => {
            if (this.dataConnections[id].connectionState == "connected") output.push(id)
        })

        return output
    }

    /**
     * Sets the ICE transport policy to relay only if mode is true, otherwise set it to all.
     *
     * @param {boolean} mode - true to set ICE transport policy to relay, false to set it to all
     */
    relayOnly(mode: boolean) {
        this.configuration.iceTransportPolicy = mode ? 'relay' : 'all'
    }

    /**
     * Programs the class to support trickle ICE if mode is true, otherwise all ICE candidates
     * will be provided once gathering is complete.
     *
     * @param {boolean} mode - true to enable trickle ICE support, false to disable
     */
    supportsTrickeIce(mode: boolean) {
        this.configuration.supportsTrickleIce = mode
    }

    /**
     * Registers a callback function to be executed when a specific event is triggered.
     *
     * @param {string} eventName - The name of the event to listen for.
     * 
     * Examples:
     * {id}_ice - When an ICE candidate has been acquired
     * {id}_ice-done - When a connection has finished gathering ICE candidates
     * {id}_open - When a connection has been established
     * {id}_closed - When a connection has been disconnected
     * {id}_message - When a message has been received from a data channel
     * {id}_channel-open - When a data channel has been established
     * {id}_channel-close - When a data channel has been disconnected
     * 
     * @param {(...args: any[]) => void} callback - The function to be executed when the event is triggered.
     */
    on(eventName: string, callback: (...args: any[]) => void) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, [])
        }
        this.eventHandlers.get(eventName)!.push(callback)
    }

    /**
     * A function that triggers a specified event with optional arguments.
     *
     * @param {string} eventName - the name of the event to trigger
     * @param {...any} args - optional arguments to pass to the event handlers
     */
    fire(eventName: string, ...args: any[]) {
        if (!this.eventHandlers.has(eventName)) {
            return
        }
        this.eventHandlers.get(eventName)!.forEach((callback) => {
            callback(...args)
        })
    }
    
    /**
     * Creates an offer for the given id, name and mode.
     *
     * @param {string} id - The id of the connection.
     * @param {string} name - The user-friendly name of the connection.
     * @param {number} mode - The mode to create the connection in. 0 for data, 1 for voice.
     * @param {boolean} setup - Optional: If the connection is used for voice, set to true if we want to transmit audio. Otherwise, only accept incoming audio.
     * @return {RTCSessionDescriptionInit | void} The created offer or void if an error occurs.
     */
    async createOffer(id: string, name: string, mode: number, setup?: boolean) : Promise<RTCSessionDescriptionInit | void> {
        try {
            const conn = await this.getConnectionObject(id, mode, setup) as PeerConnection
            conn.name = name
            const offer = await conn.createOffer()
            await conn.setLocalDescription(offer)
            return offer
        } catch (error: any) {
            console.error(`Failed to create offer: ${error.message}`)
        }
    }

    /**
     * Create an answer for the given id, name, mode and offer.
     *
     * @param {string} id - The id of the connection.
     * @param {string} name - The user-friendly name of the connection.
     * @param {number} mode - The mode to create the connection in. 0 for data, 1 for voice.
     * @param {RTCSessionDescriptionInit} offer - The incoming offer for the connection.
     * @param {boolean} setup - Optional: If the connection is used for voice, set to true if we want to transmit audio. Otherwise, only accept incoming audio.
     * @return {Promise<RTCSessionDescriptionInit | void>} The created answer or void if an error occurs.
     */
    async createAnswer(id: string, name: string, mode: number, offer: RTCSessionDescriptionInit, setup?: boolean) : Promise<RTCSessionDescriptionInit | void> {
        try {
            const conn = await this.getConnectionObject(id, mode, setup) as PeerConnection
            conn.name = name
            await conn.setRemoteDescription(new RTCSessionDescription(offer))
            const answer = await conn.createAnswer()
            await conn.setLocalDescription(answer)
            return answer
        } catch (error: any) {
            console.error(`Failed to create answer: ${error.message}`)
        }
    }

    /**
     * Handles an answer for the given id, mode and answer.
     *
     * @param {string} id - The id of the connection.
     * @param {number} mode - The mode to handle the connection in. 0 for data, 1 for voice.
     * @param {RTCSessionDescriptionInit} answer - The incoming answer for the connection.
     */
    async handleAnswer(id: string, mode: number, answer: RTCSessionDescriptionInit) : Promise<void> {
        try {
            const conn = await this.getConnectionObject(id, mode) as PeerConnection
            await conn.setRemoteDescription(new RTCSessionDescription(answer))
        } catch (error: any) {
            console.error(`Failed to handle answer: ${error.message}`)
        }
    }

    /**
     * Handles an ICE candidate for the given id, mode and candidate.
     *
     * @param {string} id - The id of the connection.
     * @param {number} mode - The mode to handle the connection in. 0 for data, 1 for voice.
     * @param {RTCIceCandidate} candidate - The incoming ICE candidate for the connection.
     */
    async handleIceCandidate(id: string, mode: number, candidate: RTCIceCandidate) : Promise<void> {
        try {
            const conn = await this.getConnectionObject(id, mode) as PeerConnection
            await conn.addIceCandidate(candidate)
        } catch (error: any) {
            console.error(`Failed to handle ICE candidate: ${error.message}`)
        }
    }
    
    /**
     * Creates or returns a connection based on the given id and mode.
     *
     * @param {string} id - The id for the connection.
     * @param {number} mode - The mode indicating the type of connection to create. 0 for data, 1 for voice.
     * @return {PeerConnection} The created or returned PeerConnection or an error if mode is invalid.
     */
    async getConnectionObject(id: string, mode: number, setup?: boolean) : Promise<PeerConnection> {
        switch (mode) {
            case 0: // Data
                return this.getDataConnection(id)
            case 1: // Voice
                if (typeof setup === 'undefined') throw new Error('Missing setup parameter for voice connection.')
                return this.getVoiceConnection(id, setup)
            default:
                throw new Error(`Invalid connection mode. Expected 0 (data) or 1 (voice), got ${mode} instead.`)
        }
    }

    /**
     * Get an array of all data channels for a peer with a given ID.
     *
     * @param {string} id - The ID of the data channels.
     * @return {Array<string>} An array of peer channels.
     */
    getPeerChannels(id: string) : Array<string> {
        return Array.from(this.dataChannels[id].keys())
    }

    /**
     * Returns true if a peer with the given ID exists and is connected.
     *
     * @param {string} id - description of parameter
     * @return {boolean} description of return value
     */
    isPeerConnected(id: string) : boolean {
        if (!this.dataConnections.has(id)) return false
        const conn = this.dataConnections.get(id) as PeerConnection
        return conn.connectionState === 'connected'
    }
    
    /**
     * Check if a specific label exists for a given channel ID.
     *
     * @param {string} id - The ID of the channel to check.
     * @param {string} label - The label to check for in the channel.
     * @return {boolean} True if the label exists in the channel, false otherwise.
     */
    doesPeerChannelExist(id: string, label: string) : boolean {
        if (!this.dataChannels.has(id)) return false
        return this.dataChannels[id].has(label)
    }

    /**
     * Close a specific channel identified by id and label.
     *
     * @param {string} id - The unique identifier of the channel.
     * @param {string} label - The label associated with the channel.
     * @return {void} This function does not return anything.
     */
    closeChannel(id: string, label: string) : void {
        if (!this.dataChannels.has(id)) return
        if (!this.dataChannels[id].has(label)) return
        const chan = this.dataChannels[id][label] as RTCDataChannel
        chan.close()
        this.dataChannels[id].delete(label)
        this.dataStorage[id].delete(label)
    }

    /**
     * Creates or returns a data connection based on the provided id.
     *
     * @param {string} id - The unique identifier for the connection.
     * @return {PeerConnection} The created or existing data connection.
     */
    getDataConnection(id: string) : PeerConnection {

        // If the connection already exists, return it
        if (this.dataConnections.has(id)) return this.dataConnections.get(id) as PeerConnection

        // Create connection and properties
        const conn = new PeerConnection(this.configuration)
        this.dataIceCandidates[id] = new Array<RTCIceCandidate>()
        this.dataIceDone[id] = false
        this.dataStorage[id] = new Map();

        // Setup data channels and create default channel
        this.dataChannels[id] = new Map<string, RTCDataChannel>()
        this.handleDataChannel(
            conn.createDataChannel('default', { 
                negotiated: true, 
                id: 0, 
                ordered: true 
            }), 
            id, 
            'default'
        )

        // Handle ICE gathering
        conn.onicecandidate = (event : RTCPeerConnectionIceEvent) => {
            if (event.candidate) this.dataIceCandidates[id].push(event.candidate)
            switch (conn.iceGatheringState) {
                case 'gathering':
                    if (this.configuration.supportsTrickleIce) this.fire(`${id}_ice`, event.candidate)
                    break
                case 'complete':
                    this.fire(`${id}_ice-done`, event.candidate)
                    this.dataIceDone[id] = true
                    break
            }
        }

        // Handle connection state changes
        conn.onconnectionstatechange = () => {
            switch (conn.connectionState) {
                case 'new':
                    console.log(`Data peer ${id} created.`)
                    break
                case 'connecting':
                    console.log(`Data peer ${id} connecting...`)
                    break
                case 'connected':
                    console.log(`Data peer ${id} connected.`)
                    this.fire(`${id}_connected`)
                    break
                case 'closed':
                    console.log(`Data peer ${id} disconnected.`)
                    this.closeDataConnection(id)
                    this.fire(`${id}_closed`)
                    
                    break
                case 'failed':
                    console.log(`Data peer ${id} failed.`)
                    this.closeDataConnection(id)
                    this.fire(`${id}_closed`)
                    break
            }
        }

        // Handle in-band data channel creation
        conn.ondatachannel = (event : RTCDataChannelEvent) => this.handleDataChannel(event.channel, event.channel.label, id)

        // Store the object in the connections map
        this.dataConnections[id] = conn

        // Return the connection object
        return conn;
    }

    /**
     * Store the RTCDataChannel object in the data channels map, and binds
     * event handlers to process incoming data.
     *
     * @param {RTCDataChannel} chan - the RTCDataChannel object to store
     * @param {string} label - the label associated with the RTCDataChannel
     * @param {string} id - the connection id associated with the RTCDataChannel
     */
    handleDataChannel(chan: RTCDataChannel, label: string, id: string) {
        chan.onmessage = (event) => {
            this.dataStorage[id][label] = event.data
            this.fire(`${id}_message`, event.data)
        }

        chan.onopen = () => {
            this.fire(`${id}_channel-open`, label)
        }

        chan.onclose = () => {
            this.fire(`${id}_channel-close`, label)
        }

        // Store the object in the data channels map
        this.dataChannels[id][label] = chan
    }

    /**
     * Returns the most recent data received from a connection.
     *
     * @param {string} id - ID of the connection
     * @param {string} label - channel label to get data from
     * @return {any | void} the most recent data, or void if there is no data
     */
    getChannelData(id: string, label: string) : any | void {
        if (!this.dataStorage.has(id)) return
        if (!this.dataStorage[id].has(label)) return
        return this.dataStorage[id][label];
    }

    /**
     * Sends data to a specific connection id, and through a specific data channel label.
     *
     * @param {string} id - The ID of the connection.
     * @param {string} label - The label of the data channel to send the data through.
     * @param {string} data - The data to be sent.
     * @param {boolean} wait - Flag indicating whether to wait for the send operation to complete.
     * @return {Promise<void> | void} If wait is true, returns a Promise that resolves when the send operation completes.
     */
    sendData(id: string, label: string, data: string, wait: boolean) : Promise<void> | void {
        if (!this.dataChannels.has(id)) return
        if (!this.dataChannels[id].has(label)) return
        const chan = this.dataChannels[id][label] as RTCDataChannel

        if (wait) chan.bufferedAmountLowThreshold = 0

        chan.send(data)

        if (wait) return new Promise((resolve: (value: void) => void) => {
            chan.onbufferedamountlow = () => resolve()
        })
    }

    /**
     * A function to prepare the a connection by adding audio tracks from the user's media devices.
     *
     * @param {PeerConnection} conn - The PeerConnection object to add audio tracks to.
     */
    async setupVoiceConnection(id: string) : Promise<void> {
        const conn = this.voiceConnections.get(id) as PeerConnection
        await navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(stream => {
            stream.getTracks().forEach(track => conn.addTrack(track, stream))
            console.log(`Ready for voice stream with ${conn.name}.`)
        })
        .catch(err => {
            console.error(`Error preparing audio stream for ${conn.name}: ${err}`)
            this.closeVoiceConnection(id)
        })
    }

    /**
     * Closes a data connection based on the given ID.
     *
     * @param {string} id - The ID of the data connection to close.
     * @return {void}
     */
    closeDataConnection(id: string) : void {
        const conn = this.dataConnections.get(id) as PeerConnection
        conn.close()

        // Cleanup data channels
        for (const chan of this.dataChannels[id].values() as RTCDataChannel[]) chan.close()

        // Delete the connection
        this.dataConnections.delete(id)
        this.dataChannels.delete(id)
        this.dataStorage.delete(id)
        this.dataIceCandidates.delete(id)
        this.dataIceDone.delete(id)
    }

    /**
     * Closes a voice connection based on the given ID.
     *
     * @param {string} id - The ID of the connection to close
     * @return {void} 
     */
    closeVoiceConnection(id: string) : void {
        const conn = this.voiceConnections.get(id) as PeerConnection

        // Stop all audio track
        conn.getSenders().forEach(sender => {
            if (sender.track) sender.track.stop()
        })

        // Remove all playing audio elements if they exist
        for (let n = 0; n < this.voiceStreams[id].length; n++) {
            const audioElement = document.getElementById(`audio_${n}_${id}`)
            if (audioElement) document.body.removeChild(audioElement)
        }

        // Delete the connection
        this.voiceConnections.delete(id)
        this.voiceIceCandidates.delete(id)
        this.voiceStreams.delete(id)
        this.voiceIceDone.delete(id)
    }

    /**
     * Create a new RTCDataChannel for the given id, label, and ordered flag.
     *
     * @param {string} id - The id for the connection.
     * @param {string} label - The label for the data channel.
     * @param {boolean} ordered - Indicates if the data channel is ordered.
     * @return {RTCDataChannel | void} The newly created data channel or void if the connection id is not found.
     */
    createDataChannel(id: string, label: string, ordered: boolean) : RTCDataChannel | void {
        if (!this.dataConnections.has(id)) return
        const conn = this.dataConnections.get(id) as PeerConnection
        return conn.createDataChannel(label, { negotiated: false, ordered, protocol: "clomega"})
    }

    /**
     * Creates or returns a voice connection based on the provided id.
     *
     * @param {string} id - The unique identifier of the connection.
     * @param {boolean} setup - If true, ask the user to allow microphone access and add audio tracks to the connection.
     * @return {PeerConnection} The created or existing voice connection.
     */
    async getVoiceConnection(id: string, setup: boolean) : Promise<PeerConnection> {

        // If the connection already exists, return it
        if (this.voiceConnections.has(id)) return this.voiceConnections.get(id) as PeerConnection

        // Create connection and properties
        const conn = new PeerConnection(this.configuration)
        this.voiceIceCandidates[id] = new Array<RTCIceCandidate>()
        this.voiceIceDone[id] = false
        this.voiceStreams[id] = new Array<MediaStream>()

        // Handle ICE gathering
        conn.onicecandidate = (event : RTCPeerConnectionIceEvent) => {
            if (event.candidate) this.voiceIceCandidates[id].push(event.candidate)
            if (conn.iceGatheringState === 'complete') this.voiceIceDone[id] = true
        }

        // Handle connection state changes
        conn.onconnectionstatechange = () => {
            switch (conn.connectionState) {
                case 'new':
                    console.log(`Voice peer ${id} created.`)
                    break
                case 'connecting':
                    console.log(`Voice peer ${id} connecting...`)
                    break
                case 'connected':
                    console.log(`Voice peer ${id} connected.`)
                    break
                case 'closed':
                    console.log(`Voice peer ${id} disconnected.`)
                    this.closeVoiceConnection(id)
                    break
                case 'failed':
                    console.log(`Voice peer ${id} failed.`)
                    this.closeVoiceConnection(id)
                    break
            }
        }

        conn.ontrack = (event : RTCTrackEvent) => {
            console.log(`Adding peer ${id} incoming streams: ${event.streams.length} streams incoming.`)

            // Auto-play incoming audio streams
            let n = 0;
            for (const stream of event.streams) {

                // Add the stream to the array
                this.voiceStreams[id].push(stream)

                // Define the options for the audio element
                const options = {
                    id: `audio_${n}_${id}`,
                    autoplay: true,
                    srcObject: stream
                } as ElementCreationOptions

                // Create the audio element and attach it to the DOM
                const audioElement = document.createElement(`audio`, options)
                document.body.appendChild(audioElement)

                // Increment the stream counter
                n++
            }
        }

        // Store the object in the connections map
        this.voiceConnections[id] = conn

        // Setup audio steams for the connection
        if (setup) await this.setupVoiceConnection(id)

        // Return the connection object
        return conn
    }
}