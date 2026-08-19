const {
  PermissionFlagsBits,
} = require('discord.js');

function isAdmin(member) {
  return member.permissions.has(
    PermissionFlagsBits.Administrator
  );
}

function isModerator(member) {
  return (
    isAdmin(member) ||
    member.permissions.has(
      PermissionFlagsBits.KickMembers
    ) ||
    member.permissions.has(
      PermissionFlagsBits.BanMembers
    ) ||
    member.permissions.has(
      PermissionFlagsBits.ModerateMembers
    )
  );
}

function canManageGuild(member) {
  return (
    isAdmin(member) ||
    member.permissions.has(
      PermissionFlagsBits.ManageGuild
    )
  );
}

function canManageMessages(member) {
  return (
    isAdmin(member) ||
    member.permissions.has(
      PermissionFlagsBits.ManageMessages
    )
  );
}

module.exports = {
  isAdmin,
  isModerator,
  canManageGuild,
  canManageMessages,
};