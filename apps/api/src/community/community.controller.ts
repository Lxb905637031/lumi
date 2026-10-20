import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-request';
import { CursorPaginationDto } from '../common/pagination/pagination.dto';
import {
  CommunityQueryDto,
  CreateCommentDto,
  CreatePostDto,
  ReportPostDto,
  SetFollowDto,
  SetInteractionDto,
} from './community.dto';
import { CommunityService } from './community.service';
import { FollowService } from './follow.service';

@Controller('community')
export class CommunityController {
  constructor(
    private readonly community: CommunityService,
    private readonly follows: FollowService,
  ) {}

  @Put('users/:id/follow')
  @UseGuards(AuthGuard)
  follow(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SetFollowDto) {
    return this.follows.set(user.id, id, dto.active);
  }

  @Get('users/:id/follow-state')
  @UseGuards(AuthGuard)
  followState(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.follows.state(user.id, id);
  }

  @Get('me/followers')
  @UseGuards(AuthGuard)
  followers(@CurrentUser() user: AuthenticatedUser, @Query() query: CursorPaginationDto) {
    return this.follows.list(user.id, 'followers', query);
  }

  @Get('me/following')
  @UseGuards(AuthGuard)
  following(@CurrentUser() user: AuthenticatedUser, @Query() query: CursorPaginationDto) {
    return this.follows.list(user.id, 'following', query);
  }

  @Get('posts')
  list(@Query() query: CommunityQueryDto) {
    return this.community.list(query, query.topic);
  }

  @Get('me/posts')
  @UseGuards(AuthGuard)
  mine(@CurrentUser() user: AuthenticatedUser, @Query() query: CommunityQueryDto) {
    return this.community.list(query, query.topic, user.id);
  }

  @Get('me/bookmarks')
  @UseGuards(AuthGuard)
  bookmarks(@CurrentUser() user: AuthenticatedUser, @Query() query: CommunityQueryDto) {
    return this.community.list(query, query.topic, undefined, user.id);
  }

  @Get('posts/:id/comments')
  comments(@Param('id') id: string, @Query() query: CursorPaginationDto) {
    return this.community.listComments(id, query);
  }

  @Get('posts/:id/state')
  @UseGuards(AuthGuard)
  state(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.community.interactionState(user.id, id);
  }

  @Get('posts/:id/comments/:commentId')
  commentDetail(@Param('id') id: string, @Param('commentId') commentId: string) {
    return this.community.findComment(id, commentId);
  }

  @Get('posts/:id')
  findOne(@Param('id') id: string) {
    return this.community.findPublic(id);
  }

  @Post('posts')
  @UseGuards(AuthGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePostDto) {
    return this.community.create(user.id, dto);
  }

  @Delete('posts/:id')
  @UseGuards(AuthGuard)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.community.remove(user.id, id);
  }

  @Post('posts/:id/like')
  @UseGuards(AuthGuard)
  like(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SetInteractionDto) {
    return this.community.setLike(user.id, id, dto.active);
  }

  @Post('posts/:id/bookmark')
  @UseGuards(AuthGuard)
  bookmark(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SetInteractionDto) {
    return this.community.setBookmark(user.id, id, dto.active);
  }

  @Post('posts/:id/comments')
  @UseGuards(AuthGuard)
  comment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateCommentDto) {
    return this.community.addComment(user.id, id, dto.body);
  }

  @Delete('comments/:id')
  @UseGuards(AuthGuard)
  removeComment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.community.removeComment(user.id, id);
  }

  @Post('posts/:id/reports')
  @UseGuards(AuthGuard)
  report(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReportPostDto) {
    return this.community.report(user.id, id, dto.reason);
  }
}
