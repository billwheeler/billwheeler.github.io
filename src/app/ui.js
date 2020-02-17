'use strict'

var Entities = require('./entities.js')
var Storage = require('./storage.js')

var active = document.getElementById('active')
var inactive = document.getElementById('inactive')
var deadguys = document.getElementById('deadguys')

var update = function () {
    Storage.push(Entities.push()).then(() => {
        render()
    })
}

var render = function () {
    active.innerHTML = ''
    inactive.innerHTML = ''
    deadguys.innerHTML = ''

    Entities.charsByState(CharacterState.Encounter, function () {
        var row = document.createElement('tr')
        var cell = document.createElement('td')

        cell.innerHTML = this.render()

        row.appendChild(cell)
        active.appendChild(row)
    })

    Entities.charsByState(CharacterState.Idle, function () {
        var row = document.createElement('tr')
        var cell = document.createElement('td')

        cell.innerHTML = this.render()

        row.appendChild(cell)
        inactive.appendChild(row)
    })

    Entities.charsByState(CharacterState.Dead, function () {
        var row = document.createElement('tr')
        var cell = document.createElement('td')

        cell.innerHTML = this.render()

        row.appendChild(cell)
        deadguys.appendChild(row)
    })
}

var addListener = function () {
    document.addEventListener('click', function (e) {
        if (e.target) {
            var doUpdate = true;
            var id = parseInt(e.target.getAttribute('data-id'))

            switch (e.target.className) {
                case 'hard_reset':
                    doUpdate = false
                    if (confirm('Are you sure? This cannot be undone.')) {
                        var cell = document.getElementById('main-content')

                        Storage.reset().then(() => {
                            Entities.reset()
                            cell.innerHTML = 'resetting up in here'
                            setTimeout(() => window.location.reload(), 600)
                        })
                    }
                    break
                case 'player_initiative':
                    var initiative = parseInt(document.getElementById('player_initiative_' + id).value)
                    if (Utils.isInteger(initiative)) Entities.updatePlayer(id, CharacterAction.Initiative, [initiative])
                    break
                case 'player_leave':
                    Entities.updatePlayer(id, CharacterAction.Leave)
                    break;
                case 'player_revive':
                    Entities.updatePlayer(id, CharacterAction.Revive)
                    break
                case 'player_die':
                    Entities.updatePlayer(id, CharacterAction.Die)
                    break
                case 'player_concentrate':
                    Entities.updatePlayer(id, CharacterAction.Concentrate)
                    break
                case 'player_toggle':
                    Entities.updatePlayer(id, CharacterAction.Toggle)
                    break
                case 'player_condition_remove':
                    Entities.updatePlayer(id, CharacterAction.RemoveCondition, [e.target.getAttribute('data-condition'), false])
                    break
                case 'npc_initiative':
                    Entities.updateNpc(id, CharacterAction.Initiative)
                    break
                case 'npc_damage':
                    var damage = parseInt(document.getElementById('npc_damage_' + id).value)
                    if (Utils.isInteger(damage)) Entities.updateNpc(id, CharacterAction.Damage, [damage])
                    break
                case 'npc_leave':
                    Entities.updateNpc(id, CharacterAction.Leave)
                    break
                case 'npc_revive':
                    Entities.updateNpc(id, CharacterAction.Revive)
                    break
                case 'npc_die':
                    Entities.updateNpc(id, CharacterAction.Die)
                    break
                case 'npc_rest':
                    Entities.updateNpc(id, CharacterAction.Rest)
                    break
                case 'npc_spell_slot':
                    var spellSlotId = parseInt(e.target.getAttribute('data-level-id'))
                    var checked = e.target.checked
                    if (Utils.isInteger(spellSlotId)) Entities.updateNpc(id, CharacterAction.Spell, [spellSlotId, checked])
                    break
                case 'npc_concentrate':
                    Entities.updateNpc(id, CharacterAction.Concentrate)
                    break
                case 'npc_toggle':
                    Entities.updateNpc(id, CharacterAction.Toggle)
                    break
                case 'npc_condition_remove':
                    Entities.updateNpc(id, CharacterAction.RemoveCondition, [e.target.getAttribute('data-condition'), false])
                    break
                case 'vehicle_toggle':
                    Entities.updateVehicle(id, CharacterAction.Toggle)
                    break
                case 'component_damage':
                    var vehicleId = parseInt(e.target.getAttribute('data-vehicle-id'))
                    var damage = parseInt(document.getElementById('component_damage_' + id).value)
                    if (Utils.isInteger(damage)) Entities.updateVehicle(vehicleId, CharacterAction.Damage, [id, damage])
                    break
                default:
                    doUpdate = false;
                    break
            }

            if (doUpdate) update()
        }
    })

    document.addEventListener('change', function (e) {
        if (e.target) {
            var doUpdate = true;
            var id = parseInt(e.target.getAttribute('data-id'))

            switch (e.target.className) {
                case 'player_condition_add':
                    Entities.updatePlayer(id, CharacterAction.AddCondition, [e.target.options[e.target.selectedIndex].value, true])
                    break
                case 'npc_condition_add':
                    Entities.updateNpc(id, CharacterAction.AddCondition, [e.target.options[e.target.selectedIndex].value, true])
                    break
                case 'player_exhaustion':
                    Entities.updatePlayer(id, CharacterAction.ApplyExhaustion, [CharacterCondition.Exhaustion, parseInt(e.target.options[e.target.selectedIndex].value)])
                    break
                default:
                    doUpdate = false
            }

            if (doUpdate) update()
        }
    })
}

var run = function () {
    addListener()

    Storage.pull().then(([data]) => {
        Entities.pull(data)
        render()
    })
}

module.exports = {
    run: run
}